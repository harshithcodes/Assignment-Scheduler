import express from 'express';
import { supabaseAdmin } from '../config/database.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { body, validationResult } from 'express-validator';
import { createCalendarEventWithMeet } from '../config/googleCalendar.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Faculty: Create available time slots
router.post(
  '/',
  requireRole('faculty', 'admin'),
  [
    body('start_time').isISO8601().toDate(),
    body('end_time').isISO8601().toDate(),
    body('date').isISO8601().toDate(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { start_time, end_time, date } = req.body;
      const faculty_id = req.user.id;

      // Extract time portions from datetime strings (HH:MM:SS format)
      const startTimeOnly = new Date(start_time).toTimeString().split(' ')[0];
      const endTimeOnly = new Date(end_time).toTimeString().split(' ')[0];
      const dateOnly = new Date(date).toISOString().split('T')[0];

      // Validate time range
      if (new Date(end_time) <= new Date(start_time)) {
        return res.status(400).json({ error: 'End time must be after start time' });
      }

      // Check for overlapping slots
      const { data: overlapping, error: overlapError } = await supabaseAdmin
        .from('slots')
        .select('*')
        .eq('faculty_id', faculty_id)
        .eq('date', dateOnly)
        .or(`and(start_time.lte.${startTimeOnly},end_time.gt.${startTimeOnly}),and(start_time.lt.${endTimeOnly},end_time.gte.${endTimeOnly}),and(start_time.gte.${startTimeOnly},end_time.lte.${endTimeOnly})`);

      if (overlapError) throw overlapError;

      if (overlapping && overlapping.length > 0) {
        return res.status(409).json({ error: 'Time slot overlaps with existing slot' });
      }

      const { data: slot, error } = await supabaseAdmin
        .from('slots')
        .insert([
          {
            faculty_id,
            start_time: startTimeOnly,
            end_time: endTimeOnly,
            date: dateOnly,
            status: 'available'
          }
        ])
        .select()
        .single();

      if (error) throw error;

      res.status(201).json({ slot, message: 'Slot created successfully' });
    } catch (error) {
      console.error('Create slot error:', error);
      res.status(500).json({ 
        error: 'Failed to create slot',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

// Get all available slots (with optional faculty filter)
router.get('/available', async (req, res) => {
  try {
    const { faculty_id, date } = req.query;
    
    let query = supabaseAdmin
      .from('slots')
      .select(`
        *,
        faculty:users!slots_faculty_id_fkey(id, name, email, picture)
      `)
      .eq('status', 'available')
      .gte('date', new Date().toISOString().split('T')[0]);

    if (faculty_id) {
      query = query.eq('faculty_id', faculty_id);
    }

    if (date) {
      query = query.eq('date', date);
    }

    query = query.order('date').order('start_time');

    const { data: slots, error } = await query;

    if (error) throw error;

    res.json({ slots });
  } catch (error) {
    console.error('Get slots error:', error);
    res.status(500).json({ error: 'Failed to fetch slots' });
  }
});

// Helper function to create real Google Meet using Calendar API
async function createRealGoogleMeet(slot, faculty, scholar) {
  try {
    // Combine date and time into full datetime
    const startDateTime = new Date(`${slot.date}T${slot.start_time}`);
    const endDateTime = new Date(`${slot.date}T${slot.end_time}`);

    const eventDetails = {
      summary: `Assignment Demo - ${scholar.name} with ${faculty.name}`,
      description: `Assignment demonstration session.\n\nScholar: ${scholar.name} (${scholar.email})\nFaculty: ${faculty.name} (${faculty.email})\n\nNotes: ${slot.notes || 'No additional notes'}`,
      startDateTime: startDateTime.toISOString(),
      endDateTime: endDateTime.toISOString(),
      attendees: [scholar.email, faculty.email],
    };

    const result = await createCalendarEventWithMeet(eventDetails);
    return result.meetLink;
  } catch (error) {
    console.error('Failed to create real Google Meet:', error);
    // Fallback to random link if API fails
    return generateFallbackMeetLink();
  }
}

// Fallback: Generate a random meet code (abc-defg-hij format) if API fails
function generateFallbackMeetLink() {
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  const segments = [];
  for (let i = 0; i < 3; i++) {
    let segment = '';
    const length = i === 1 ? 4 : 3;
    for (let j = 0; j < length; j++) {
      segment += chars[Math.floor(Math.random() * chars.length)];
    }
    segments.push(segment);
  }
  return `https://meet.google.com/${segments.join('-')}`;
}

// Helper function to generate Google Calendar link
function generateCalendarLink(slot, faculty, scholar) {
  const startDateTime = new Date(`${slot.date}T${slot.start_time}`);
  const endDateTime = new Date(`${slot.date}T${slot.end_time}`);
  
  const formatDate = (date) => {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  const title = `Assignment Demo - ${scholar.name} with ${faculty.name}`;
  const description = `Meeting between ${scholar.name} and ${faculty.name}\n\nNotes: ${slot.notes || 'No additional notes'}\n\nGoogle Meet: ${slot.meeting_link}`;
  
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    details: description,
    dates: `${formatDate(startDateTime)}/${formatDate(endDateTime)}`,
    add: `${scholar.email},${faculty.email}`,
    sf: 'true',
    output: 'xml'
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

// Scholar: Book a slot
router.post('/:slotId/book', requireRole('scholar'), async (req, res) => {
  try {
    const { slotId } = req.params;
    const scholar_id = req.user.id;
    const { notes } = req.body;

    // Check if slot exists and is available
    const { data: slot, error: slotError } = await supabaseAdmin
      .from('slots')
      .select('*, faculty:users!slots_faculty_id_fkey(id, name, email)')
      .eq('id', slotId)
      .eq('status', 'available')
      .single();

    if (slotError || !slot) {
      return res.status(404).json({ error: 'Slot not available' });
    }

    // Create real Google Meet using Calendar API
    const meetingLink = await createRealGoogleMeet(slot, slot.faculty, req.user);

    // Update slot status to booked with meeting link
    const { error: updateError } = await supabaseAdmin
      .from('slots')
      .update({ 
        status: 'booked',
        scholar_id,
        notes: notes || null,
        meeting_link: meetingLink
      })
      .eq('id', slotId);

    if (updateError) throw updateError;

    // Fetch updated slot with relations
    const { data: bookedSlot, error: fetchError } = await supabaseAdmin
      .from('slots')
      .select(`
        *,
        faculty:users!slots_faculty_id_fkey(id, name, email, picture),
        scholar:users!slots_scholar_id_fkey(id, name, email, picture)
      `)
      .eq('id', slotId)
      .single();

    if (fetchError) throw fetchError;

    // Generate calendar link for adding to Google Calendar
    const calendarLink = generateCalendarLink(
      bookedSlot, 
      bookedSlot.faculty, 
      req.user
    );

    res.json({ 
      slot: bookedSlot, 
      message: 'Slot booked successfully',
      meetingLink: meetingLink,
      calendarLink: calendarLink
    });
  } catch (error) {
    console.error('Book slot error:', error);
    res.status(500).json({ error: 'Failed to book slot' });
  }
});

// Get user's bookings (scholar view)
router.get('/my-bookings', requireRole('scholar'), async (req, res) => {
  try {
    const { data: bookings, error } = await supabaseAdmin
      .from('slots')
      .select(`
        *,
        faculty:users!slots_faculty_id_fkey(id, name, email, picture)
      `)
      .eq('scholar_id', req.user.id)
      .order('date')
      .order('start_time');

    if (error) throw error;

    res.json({ bookings });
  } catch (error) {
    console.error('Get bookings error:', error);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// Get faculty's slots (faculty view)
router.get('/my-slots', requireRole('faculty', 'admin'), async (req, res) => {
  try {
    const { data: slots, error } = await supabaseAdmin
      .from('slots')
      .select(`
        *,
        scholar:users!slots_scholar_id_fkey(id, name, email, picture)
      `)
      .eq('faculty_id', req.user.id)
      .order('date')
      .order('start_time');

    if (error) throw error;

    res.json({ slots });
  } catch (error) {
    console.error('Get faculty slots error:', error);
    res.status(500).json({ error: 'Failed to fetch slots' });
  }
});

// Faculty: Delete a slot (only if not booked)
router.delete('/:slotId', requireRole('faculty', 'admin'), async (req, res) => {
  try {
    const { slotId } = req.params;

    // Check if slot belongs to faculty and is not booked
    const { data: slot, error: fetchError } = await supabaseAdmin
      .from('slots')
      .select('*')
      .eq('id', slotId)
      .eq('faculty_id', req.user.id)
      .single();

    if (fetchError || !slot) {
      return res.status(404).json({ error: 'Slot not found' });
    }

    if (slot.status === 'booked') {
      return res.status(403).json({ error: 'Cannot delete booked slot' });
    }

    const { error: deleteError } = await supabaseAdmin
      .from('slots')
      .delete()
      .eq('id', slotId);

    if (deleteError) throw deleteError;

    res.json({ message: 'Slot deleted successfully' });
  } catch (error) {
    console.error('Delete slot error:', error);
    res.status(500).json({ error: 'Failed to delete slot' });
  }
});

export default router;


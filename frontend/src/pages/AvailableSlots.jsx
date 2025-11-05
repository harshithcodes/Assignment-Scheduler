import { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { format, parseISO } from 'date-fns';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export default function AvailableSlots() {
  const { user } = useAuth();
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedFaculty, setSelectedFaculty] = useState('');
  const [faculties, setFaculties] = useState([]);

  useEffect(() => {
    fetchFaculties();
    fetchSlots();
  }, [selectedDate, selectedFaculty]);

  const fetchFaculties = async () => {
    try {
      const response = await axios.get(`${API_URL}/users/faculties`);
      setFaculties(response.data.faculties);
    } catch (error) {
      console.error('Failed to fetch faculties:', error);
    }
  };

  const fetchSlots = async () => {
    try {
      setLoading(true);
      const params = {};
      if (selectedDate) params.date = selectedDate;
      if (selectedFaculty) params.faculty_id = selectedFaculty;

      const response = await axios.get(`${API_URL}/slots/available`, { params });
      setSlots(response.data.slots);
    } catch (error) {
      console.error('Failed to fetch slots:', error);
      toast.error('Failed to load available slots');
    } finally {
      setLoading(false);
    }
  };

  const handleBookSlot = async (slotId) => {
    if (user.role !== 'scholar') {
      toast.error('Only scholars can book slots');
      return;
    }

    try {
      const response = await axios.post(`${API_URL}/slots/${slotId}/book`);
      const { meetingLink, calendarLink } = response.data;
      
      // Show success message with meeting link
      toast.success(
        (t) => (
          <div className="space-y-2">
            <p className="font-semibold">Slot booked successfully! 🎉</p>
            <a 
              href={meetingLink} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 text-sm block"
            >
              📹 Join Google Meet: {meetingLink}
            </a>
            <a 
              href={calendarLink} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-green-600 hover:text-green-800 text-sm block"
            >
              📅 Add to Calendar
            </a>
            <button
              onClick={() => {
                navigator.clipboard.writeText(meetingLink);
                toast.success('Meeting link copied!');
              }}
              className="text-xs text-gray-600 hover:text-gray-800 underline"
            >
              Copy Meeting Link
            </button>
          </div>
        ),
        { duration: 8000 }
      );
      
      fetchSlots();
    } catch (error) {
      console.error('Failed to book slot:', error);
      toast.error(error.response?.data?.error || 'Failed to book slot');
    }
  };

  const groupSlotsByDate = (slots) => {
    const grouped = {};
    slots.forEach((slot) => {
      if (!grouped[slot.date]) {
        grouped[slot.date] = [];
      }
      grouped[slot.date].push(slot);
    });
    return grouped;
  };

  const groupedSlots = groupSlotsByDate(slots);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Available Slots</h1>
        <p className="mt-2 text-gray-600">Browse and book available time slots</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Filter by Date
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Filter by Faculty
            </label>
            <select
              value={selectedFaculty}
              onChange={(e) => setSelectedFaculty(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Faculties</option>
              {faculties.map((faculty) => (
                <option key={faculty.id} value={faculty.id}>
                  {faculty.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Slots List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="spinner"></div>
        </div>
      ) : Object.keys(groupedSlots).length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-500">No available slots found</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedSlots).map(([date, dateSlots]) => (
            <div key={date} className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">
                  {format(parseISO(date), 'EEEE, MMMM d, yyyy')}
                </h3>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {dateSlots.map((slot) => (
                    <div
                      key={slot.id}
                      className="border border-gray-200 rounded-lg p-4 hover:border-blue-500 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          <img
                            src={slot.faculty.picture}
                            alt={slot.faculty.name}
                            className="h-10 w-10 rounded-full"
                          />
                          <div>
                            <p className="font-medium text-gray-900">
                              {slot.faculty.name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {slot.faculty.email}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center text-sm text-gray-600">
                          <span className="font-medium">Time:</span>
                          <span className="ml-2">
                            {slot.start_time} - {slot.end_time}
                          </span>
                        </div>
                        {user.role === 'scholar' && (
                          <button
                            onClick={() => handleBookSlot(slot.id)}
                            className="w-full mt-3 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
                          >
                            Book Slot
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


import { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { format, parseISO } from 'date-fns';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export default function FacultySlots() {
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    date: '',
    start_time: '',
    end_time: '',
  });

  useEffect(() => {
    fetchSlots();
  }, []);

  const fetchSlots = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/slots/my-slots`);
      setSlots(response.data.slots);
    } catch (error) {
      console.error('Failed to fetch slots:', error);
      toast.error('Failed to load your slots');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSlot = async (e) => {
    e.preventDefault();
    
    try {
      // Combine date and time for the API
      const startDateTime = `${formData.date}T${formData.start_time}:00`;
      const endDateTime = `${formData.date}T${formData.end_time}:00`;

      await axios.post(`${API_URL}/slots`, {
        date: formData.date,
        start_time: startDateTime,
        end_time: endDateTime,
      });

      toast.success('Slot created successfully!');
      setShowCreateForm(false);
      setFormData({ date: '', start_time: '', end_time: '' });
      fetchSlots();
    } catch (error) {
      console.error('Failed to create slot:', error);
      toast.error(error.response?.data?.error || 'Failed to create slot');
    }
  };

  const handleDeleteSlot = async (slotId) => {
    if (!window.confirm('Are you sure you want to delete this slot?')) {
      return;
    }

    try {
      await axios.delete(`${API_URL}/slots/${slotId}`);
      toast.success('Slot deleted successfully!');
      fetchSlots();
    } catch (error) {
      console.error('Failed to delete slot:', error);
      toast.error(error.response?.data?.error || 'Failed to delete slot');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'available':
        return 'bg-green-100 text-green-800';
      case 'booked':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-gray-100 text-gray-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Slots</h1>
          <p className="mt-2 text-gray-600">Manage your available time slots</p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
        >
          {showCreateForm ? 'Cancel' : '+ Create Slot'}
        </button>
      </div>

      {/* Create Slot Form */}
      {showCreateForm && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Create New Slot
          </h2>
          <form onSubmit={handleCreateSlot} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date *
                </label>
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) =>
                    setFormData({ ...formData, date: e.target.value })
                  }
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Time *
                </label>
                <input
                  type="time"
                  required
                  value={formData.start_time}
                  onChange={(e) =>
                    setFormData({ ...formData, start_time: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Time *
                </label>
                <input
                  type="time"
                  required
                  value={formData.end_time}
                  onChange={(e) =>
                    setFormData({ ...formData, end_time: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Create Slot
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Slots List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="spinner"></div>
        </div>
      ) : slots.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-500 mb-4">You haven't created any slots yet</p>
          <button
            onClick={() => setShowCreateForm(true)}
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            Create your first slot →
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="divide-y divide-gray-200">
            {slots.map((slot) => (
              <div key={slot.id} className="p-6 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-3">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                          slot.status
                        )}`}
                      >
                        {slot.status}
                      </span>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {format(parseISO(slot.date), 'MMMM d, yyyy')}
                      </h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      <div>
                        <p className="text-sm font-medium text-gray-500">Time</p>
                        <p className="text-sm text-gray-900">
                          {slot.start_time} - {slot.end_time}
                        </p>
                      </div>
                      {slot.status === 'booked' && slot.scholar && (
                        <div>
                          <p className="text-sm font-medium text-gray-500">
                            Booked by
                          </p>
                          <div className="flex items-center space-x-2 mt-1">
                            <img
                              src={slot.scholar.picture}
                              alt={slot.scholar.name}
                              className="h-6 w-6 rounded-full"
                            />
                            <div>
                              <p className="text-sm text-gray-900">
                                {slot.scholar.name}
                              </p>
                              <p className="text-xs text-gray-500">
                                {slot.scholar.email}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    {slot.notes && (
                      <div className="mt-4">
                        <p className="text-sm font-medium text-gray-500">Notes</p>
                        <p className="text-sm text-gray-900 mt-1">{slot.notes}</p>
                      </div>
                    )}
                    {slot.meeting_link && slot.status === 'booked' && (
                      <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
                        <p className="text-sm font-medium text-green-900 mb-2">
                          📹 Google Meet Link
                        </p>
                        <div className="flex items-center space-x-2">
                          <a
                            href={slot.meeting_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-green-600 hover:text-green-800 underline break-all"
                          >
                            {slot.meeting_link}
                          </a>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(slot.meeting_link);
                              toast.success('Meeting link copied to clipboard!');
                            }}
                            className="flex-shrink-0 px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition-colors"
                          >
                            Copy Link
                          </button>
                        </div>
                        <a
                          href={slot.meeting_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 inline-block px-4 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
                        >
                          Join Meeting
                        </a>
                      </div>
                    )}
                  </div>
                  {slot.status === 'available' && (
                    <button
                      onClick={() => handleDeleteSlot(slot.id)}
                      className="ml-4 text-red-600 hover:text-red-800 text-sm font-medium"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome, {user?.name}!
        </h1>
        <p className="mt-2 text-gray-600">
          You are logged in as: <span className="font-semibold capitalize">{user?.role}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
        {/* Scholar Actions */}
        {user?.role === 'scholar' && (
          <>
            <DashboardCard
              title="Browse Available Slots"
              description="View and book available time slots from faculty members"
              link="/slots"
              linkText="View Slots"
              icon="📅"
            />
            <DashboardCard
              title="My Bookings"
              description="View your scheduled assignment demo sessions"
              link="/my-bookings"
              linkText="View Bookings"
              icon="📝"
            />
          </>
        )}

        {/* Faculty Actions */}
        {(user?.role === 'faculty' || user?.role === 'admin') && (
          <>
            <DashboardCard
              title="Manage My Slots"
              description="Create and manage your available time slots"
              link="/faculty/slots"
              linkText="Manage Slots"
              icon="🗓️"
            />
            <DashboardCard
              title="Available Slots"
              description="View all available slots across faculty"
              link="/slots"
              linkText="View All Slots"
              icon="📅"
            />
          </>
        )}

        {/* Admin Actions */}
        {user?.role === 'admin' && (
          <DashboardCard
            title="Admin Panel"
            description="Manage users and promote faculty members"
            link="/admin"
            linkText="Open Panel"
            icon="⚙️"
          />
        )}

        {/* Common Info Card */}
        <DashboardCard
          title="How It Works"
          description={getRoleDescription(user?.role)}
          icon="ℹ️"
          isInfo
        />
      </div>
    </div>
  );
}

function DashboardCard({ title, description, link, linkText, icon, isInfo }) {
  const content = (
    <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
      <div className="text-4xl mb-4">{icon}</div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600 text-sm mb-4">{description}</p>
      {!isInfo && (
        <span className="text-blue-600 font-medium text-sm hover:text-blue-800">
          {linkText} →
        </span>
      )}
    </div>
  );

  if (isInfo) {
    return content;
  }

  return <Link to={link}>{content}</Link>;
}

function getRoleDescription(role) {
  switch (role) {
    case 'scholar':
      return 'Browse available time slots, book assignment demo sessions with faculty, and manage your bookings.';
    case 'faculty':
      return 'Create time slots for students to book, view your scheduled sessions, and manage your availability.';
    case 'admin':
      return 'Manage all users, promote scholars to faculty role, create slots, and oversee the entire system.';
    default:
      return 'Welcome to the Assignment Scheduler platform.';
  }
}


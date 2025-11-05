import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { loginWithGoogle } = useAuth();

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      await loginWithGoogle(credentialResponse.credential);
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  const handleGoogleError = () => {
    console.error('Google login failed');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-md w-full space-y-8 p-10 bg-white rounded-xl shadow-lg">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-bold text-gray-900">
            Assignment Scheduler
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Schedule your assignment demo sessions
          </p>
        </div>
        <div className="mt-8 space-y-6">
          <div className="flex flex-col items-center space-y-4">
            <p className="text-sm text-gray-600">Sign in with your Google account</p>
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={handleGoogleError}
              useOneTap
              theme="outline"
              size="large"
              text="signin_with"
              shape="rectangular"
            />
          </div>
          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500">
              By signing in, you agree to use this platform for scheduling assignment demos.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}


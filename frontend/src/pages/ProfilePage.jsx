import React, { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

export default function ProfilePage() {
  const { user } = useContext(AuthContext);

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold">Profile: {user?.username}</h1>
      <p className="mt-4">This place will soon be filled with your taste in movies!</p>
    </div>
  );
}

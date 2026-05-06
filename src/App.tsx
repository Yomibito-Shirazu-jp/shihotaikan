import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Form from './Form';
import Admin from './Admin';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Form />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </BrowserRouter>
  );
}

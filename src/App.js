// src/App.js

import React from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import AppRoutes from './routes';
import Navbar from './components/Navbar'; // Import the Navbar
import "./styles/global.css"

const App = () => {
  return (
    <Router>
      <div>
        <Navbar /> {/* Display the Navbar on all pages */}
        <AppRoutes /> {/* Handles routing */}
      </div>
    </Router>
  );
};

export default App;




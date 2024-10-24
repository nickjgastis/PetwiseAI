import React from 'react';
import { Link } from 'react-router-dom';

const SignupPage = () => {
    return (
        <div className="page-content" >
            <h2>Create a New Account</h2>
            <form>
                <input type="email" placeholder="Email" />
                <input type="password" placeholder="Password" />
                <button type="submit">Sign Up</button>
            </form>
            <p>Already have an account? <Link to="/login">Login here</Link></p>
        </div>
    );
};

export default SignupPage;

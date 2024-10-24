import React from 'react';
import { Link } from 'react-router-dom';

const LoginPage = () => {
    return (
        <div className="page-content" >
            <h2>Login to Your Account</h2>
            <form>
                <input type="email" placeholder="Email" />
                <input type="password" placeholder="Password" />
                <button type="submit">Login</button>
            </form>
            <p>Don't have an account? <Link to="/signup">Sign up here</Link></p>
        </div>
    );
};

export default LoginPage;

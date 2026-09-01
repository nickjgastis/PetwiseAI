import axios from 'axios';

export const DEMO_API = process.env.NODE_ENV === 'production'
    ? 'https://api.petwise.vet'
    : 'http://localhost:3001';

export const getDemoToken = () => localStorage.getItem('pw_demo') || '';

export const saveDemoToken = (token) => {
    if (!token) return;
    localStorage.setItem('pw_demo', token);
};

export const demoHeaders = () => {
    const token = getDemoToken();
    return token ? { 'X-Demo-Token': token } : {};
};

export const demoRequest = (config) => axios({
    ...config,
    withCredentials: true,
    headers: { ...demoHeaders(), ...(config.headers || {}) }
});

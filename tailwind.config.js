/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./src/**/*.{js,jsx,ts,tsx}",
        "./public/index.html"
    ],
    theme: {
        extend: {
            animation: {
                'fade-in': 'fade-in 0.5s ease-in',
                'fade-out': 'fade-out 0.3s ease-out forwards',
                'streaming': 'streaming 0.3s ease-in',
                'fade-in-up': 'fade-in-up 0.6s ease-out'
            },
            keyframes: {
                'fade-in': {
                    'from': { opacity: '0' },
                    'to': { opacity: '1' }
                },
                'fade-out': {
                    'from': { opacity: '1' },
                    'to': { opacity: '0' }
                },
                'streaming': {
                    'from': { opacity: '0' },
                    'to': { opacity: '1' }
                },
                'fade-in-up': {
                    '0%': {
                        opacity: '0',
                        transform: 'translateY(10px)'
                    },
                    '100%': {
                        opacity: '1',
                        transform: 'translateY(0)'
                    }
                }
            }
        },
    },
    plugins: [],
} 
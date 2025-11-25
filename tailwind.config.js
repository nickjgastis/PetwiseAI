/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./src/**/*.{js,jsx,ts,tsx}",
        "./public/index.html"
    ],
    theme: {
        extend: {
            colors: {
                // Primary Brand Colors
                'primary': {
                    '50': '#f0f7ff',
                    '100': '#e0efff',
                    '200': '#b9dfff',
                    '300': '#7cc7ff',
                    '400': '#5ab5ff',
                    '500': '#3db6fd', // Main primary color
                    '600': '#3468bd', // Primary deep
                    '700': '#2c5aa3',
                    '800': '#254b89',
                    '900': '#1e3c6f',
                },
                'accent': {
                    '50': '#f0fcff',
                    '100': '#ccf7ff',
                    '200': '#99efff',
                    '300': '#66e7ff',
                    '400': '#5cccf0', // Main accent color
                    '500': '#4bb8d4',
                    '600': '#3ea4b8',
                    '700': '#31909c',
                    '800': '#247c80',
                    '900': '#176864',
                },
                // Secondary Brand Colors
                'secondary': {
                    '50': '#f8fafb',
                    '100': '#f1f5f6',
                    '200': '#e3ebed',
                    '300': '#d1dde0',
                    '400': '#bfcfd3',
                    '500': '#6b7378', // Main secondary color
                    '600': '#5a6165',
                    '700': '#494f52',
                    '800': '#383d3f',
                    '900': '#272b2c',
                },
                'light': {
                    '50': '#ffffff',
                    '100': '#fefefe',
                    '200': '#fdfdfd',
                    '300': '#fcfcfc',
                    '400': '#fbfbfb',
                    '500': '#edf2f2', // Main light color
                    '600': '#d4d9d9',
                    '700': '#bbc0c0',
                    '800': '#a2a7a7',
                    '900': '#898e8e',
                },
                'warning': {
                    '50': '#fffdf7',
                    '100': '#fff9e6',
                    '200': '#fff3cc',
                    '300': '#ffedb3',
                    '400': '#ffe799',
                    '500': '#fbaeb3', // Main warning color
                    '600': '#e6a000',
                    '700': '#cc8f00',
                    '800': '#b37e00',
                    '900': '#996d00',
                },
                'success': {
                    '50': '#f7fdf0',
                    '100': '#eff9e0',
                    '200': '#dff3c1',
                    '300': '#cfeda2',
                    '400': '#bfe783',
                    '500': '#8cc740', // Main success color
                    '600': '#7db336',
                    '700': '#6e9f2c',
                    '800': '#5f8b22',
                    '900': '#507718',
                }
            },
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
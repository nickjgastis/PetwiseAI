// The PetWise "Pw" mark as inline SVG: PIMS pages with a strict img-src CSP would block an extension or data: image.
export default function PetWiseLogo({ size = 28 }) {
    return (
        <svg className="sp-logo" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
            <circle cx="16" cy="16" r="16" fill="#65d0f2" />
            <g fill="none" stroke="#ffffff" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 24.5V8.5h4.6a5.1 5.1 0 0 1 0 10.2H11" strokeWidth="3.6" />
                <path d="M16.6 20.6l1.4 4.2 1.7-3.4 1.7 3.4 1.4-4.2" strokeWidth="1.7" />
            </g>
        </svg>
    );
}

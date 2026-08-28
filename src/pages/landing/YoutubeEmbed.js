import React from 'react';

const YoutubeEmbed = ({ className = '' }) => (
    <div
        className={`relative w-full overflow-hidden rounded-xl sm:rounded-2xl bg-black ${className}`}
        style={{ aspectRatio: '16 / 9' }}
    >
        <iframe
            className="absolute inset-0 h-full w-full"
            width="560"
            height="315"
            src="https://www.youtube.com/embed/uDIvgrXXi58?si=KsMjABJStt-Nliyk"
            title="YouTube video player"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
        />
    </div>
);

export default YoutubeEmbed;

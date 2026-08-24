import React from 'react';

const YOUTUBE_SRC =
    'https://www.youtube.com/embed/uDIvgrXXi58?si=ptgUPuZgkk6oCLEH&rel=0&modestbranding=1';

const YoutubeEmbed = ({ className = '' }) => (
    <div
        className={`relative w-full overflow-hidden rounded-2xl bg-black shadow-[0_40px_100px_-30px_rgba(10,25,60,0.75)] ring-1 ring-white/10 ${className}`}
        style={{ aspectRatio: '16 / 9' }}
    >
        <iframe
            className="absolute inset-0 h-full w-full"
            src={YOUTUBE_SRC}
            title="Watch Dr. Stacey Gastis explain Petwise"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
        />
    </div>
);

export default YoutubeEmbed;

import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

const SOFT = 'rgba(45, 95, 184, 0.1)';
const SOLID = '#2d5fb8';

// Count pill that blinks blue twice whenever the count goes up.
const CountBadge = ({ count }) => {
    const prev = useRef(count);
    const [blink, setBlink] = useState(0);

    useEffect(() => {
        if (count > prev.current) setBlink((b) => b + 1);
        prev.current = count;
    }, [count]);

    return (
        <motion.span
            key={blink}
            initial={false}
            animate={
                blink
                    ? { backgroundColor: [SOFT, SOLID, SOFT, SOLID, SOFT], color: [SOLID, '#fff', SOLID, '#fff', SOLID], scale: [1, 1.18, 1, 1.18, 1] }
                    : { backgroundColor: SOFT, color: SOLID, scale: 1 }
            }
            transition={{ duration: 1.3, ease: 'easeInOut' }}
            className="min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-semibold flex items-center justify-center"
        >
            {count}
        </motion.span>
    );
};

export default CountBadge;

import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

const SOFT = 'rgba(45, 95, 184, 0.1)';
const SOLID = '#2d5fb8';

// Count pill that turns solid blue and fades back whenever the count goes up.
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
            initial={{ backgroundColor: SOFT, color: SOLID }}
            animate={
                blink
                    ? { backgroundColor: [SOFT, SOLID, SOLID, SOFT], color: [SOLID, '#fff', '#fff', SOLID] }
                    : { backgroundColor: SOFT, color: SOLID }
            }
            transition={{ duration: 1.6, ease: 'easeOut', times: [0, 0.1, 0.55, 1] }}
            className="min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-semibold flex items-center justify-center"
        >
            {count}
        </motion.span>
    );
};

export default CountBadge;

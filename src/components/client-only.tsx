
"use client";

import React from 'react';
import Loader from './loader';

const ClientOnly = ({ children }: { children: React.ReactNode }) => {
    const [hasMounted, setHasMounted] = React.useState(false);

    React.useEffect(() => {
        setHasMounted(true);
    }, []);

    if (!hasMounted) {
        return <Loader />;
    }

    return <>{children}</>;
};

export default ClientOnly;

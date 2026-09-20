"use client";

import useFcmToken from "@/hooks/useFcmToken";

const ClientFcmListener = () => {
    useFcmToken();
    return null;
};

export default ClientFcmListener;

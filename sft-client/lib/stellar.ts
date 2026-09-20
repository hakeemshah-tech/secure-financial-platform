import { isAllowed, setAllowed, getAddress } from "@stellar/freighter-api";

export const connectFreighter = async () => {
    try {
        const isAppAllowed = await isAllowed();
        let publicKey;
        if (isAppAllowed) {
            const response = await getAddress();
            publicKey = response.address;
        } else {
            const isAllowedResult = await setAllowed();
            if (isAllowedResult) {
                const response = await getAddress();
                publicKey = response.address;
            }
        }
        if (publicKey) return { publicKey };
    } catch (e) {
        console.error("Freighter connection error", e);
    }
    return null;
};

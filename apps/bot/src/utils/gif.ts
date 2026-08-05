export interface GifData {
    url: string;
    animeName?: string;
}

const FALLBACK_GIFS = [
    'https://media.tenor.com/kCZjTqCKiggAAAAC/hug.gif',
    'https://media.tenor.com/qF7mO4nnL0sAAAAC/anya-forger-spy-x-family.gif',
];

/**
 * Fetches a random SFW anime reaction gif for the given nekos.best category
 * (e.g. 'hug', 'kiss', 'cuddle'), falling back to a static gif on failure.
 */
export async function getGif(type: string): Promise<GifData> {
    try {
        const res = await fetch(`https://nekos.best/api/v2/${type}`);
        if (res.ok) {
            const data = (await res.json()) as any;
            if (data?.results?.[0]?.url) {
                return {
                    url: data.results[0].url,
                    animeName: data.results[0].anime_name,
                };
            }
        }
    } catch (e) {
        // Fallback below
    }
    return {
        url: FALLBACK_GIFS[
            Math.floor(Math.random() * FALLBACK_GIFS.length)
        ] as string,
    };
}



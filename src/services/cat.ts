interface CatData {
  id: string;
  url: string;
  width: string;
  height: string;
}

type TheCatApiResponse = CatData[];

export async function getRandomCatImageUrl(): Promise<CatData> {
  try {
    const response = await fetch('https://api.thecatapi.com/v1/images/search');

    if (!response.ok) {
      throw new Error(`Failed to fetch thecatapi: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as TheCatApiResponse;

    return data[0];
  } catch (error) {
    console.error('Error fetching cat image:', error);
    throw error;
  }
}

export async function getRandomCatImage(): Promise<ArrayBuffer> {
  const { url } = await getRandomCatImageUrl();
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'image/*',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch cat image: ${response.status} ${response.statusText}`);
    }

    return await response.arrayBuffer();
  } catch (error) {
    console.error('Error fetching cat image:', error);
    throw error;
  }
}
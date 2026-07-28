import { createCanvas } from 'canvas';

export class CanvasService {
    public static async generateWelcomeCard(
        username: string,
        avatarUrl?: string
    ): Promise<Buffer> {
        const canvas = createCanvas(700, 250);
        const ctx = canvas.getContext('2d');

        // Add background
        ctx.fillStyle = '#2c2f33';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Add text
        ctx.font = '40px sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`Bienvenue, ${username}!`, 50, 125);

        // Placeholder for more complex drawing like fetching avatar...

        return canvas.toBuffer();
    }
}

const Jimp = require('jimp');

async function processImage() {
    try {
        const image = await Jimp.read('public/dvc-logo-screen.jpg');

        image.scan(0, 0, image.bitmap.width, image.bitmap.height, function (x, y, idx) {
            const r = this.bitmap.data[idx + 0];
            const g = this.bitmap.data[idx + 1];
            const b = this.bitmap.data[idx + 2];

            // Calculate max brightness
            const max = Math.max(r, g, b);

            // Set alpha
            this.bitmap.data[idx + 3] = max;

            // Color correction
            if (max > 0) {
                this.bitmap.data[idx + 0] = Math.min(255, (r / max) * 255);
                this.bitmap.data[idx + 1] = Math.min(255, (g / max) * 255);
                this.bitmap.data[idx + 2] = Math.min(255, (b / max) * 255);
            }
        });

        await image.writeAsync('public/dvc-logo-final.png');
        console.log('Success: Processed logo saved to public/dvc-logo-final.png');
    } catch (err) {
        console.error('Error processing image:', err);
        process.exit(1);
    }
}

processImage();

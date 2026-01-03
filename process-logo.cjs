const { Jimp } = require('jimp');

async function processImage() {
    try {
        console.log('Reading image...');
        const image = await Jimp.read('public/dvc-logo-screen.jpg');
        console.log('Image read successfully. Processing pixels...');

        image.scan(0, 0, image.bitmap.width, image.bitmap.height, function (x, y, idx) {
            const r = this.bitmap.data[idx + 0];
            const g = this.bitmap.data[idx + 1];
            const b = this.bitmap.data[idx + 2];

            // Calculate max brightness
            const max = Math.max(r, g, b);

            // AGGRESSIVE THRESHOLD V4
            // Increased to 100 (approx 40% brightness).
            // Cleaning up any remaining faint color noise around the logo.
            if (max < 100) {
                this.bitmap.data[idx + 3] = 0;
                this.bitmap.data[idx + 0] = 0;
                this.bitmap.data[idx + 1] = 0;
                this.bitmap.data[idx + 2] = 0;
            } else {
                // Set alpha
                this.bitmap.data[idx + 3] = max;

                // Color correction
                // We Unmultiply alpha to restore partial colors.
                this.bitmap.data[idx + 0] = Math.min(255, (r / max) * 255);
                this.bitmap.data[idx + 1] = Math.min(255, (g / max) * 255);
                this.bitmap.data[idx + 2] = Math.min(255, (b / max) * 255);
            }
        });

        console.log('Writing output file...');
        image.write('public/dvc-logo-final-v4.png', (err) => {
            if (err) {
                console.error('Error writing file:', err);
                process.exit(1);
            } else {
                console.log('Success: Processed logo saved to public/dvc-logo-final-v4.png');
            }
        });
    } catch (err) {
        console.error('Error processing image:', err);
        process.exit(1);
    }
}

processImage();

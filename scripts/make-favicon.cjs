const { Jimp } = require('jimp');
const path = require('path');

async function createCircularFavicon() {
    try {
        const inputPath = path.join(__dirname, '../src/assets/branding/dvc-logo-circle.png');
        const outputPath = path.join(__dirname, '../public/dvc-favicon.png');

        console.log(`Reading image from: ${inputPath}`);
        const image = await Jimp.read(inputPath);

        const size = 64;
        image.resize({ w: size, h: size });

        const outputImage = new Jimp({ width: size, height: size, color: 0x00000000 });

        const center = size / 2;
        const radius = (size / 2) - 1;

        // Scan uses x, y, idx arguments in callback? 
        // In v1 scan might pass an object or different args.
        // But if previous run didn't error on scan, it might be ok.
        // However, let's double check if it actually did anything.
        // I'll log inside scan to be sure.

        let pixelsModified = 0;
        outputImage.scan((x, y, idx) => {
            const distance = Math.sqrt(Math.pow(x - center, 2) + Math.pow(y - center, 2));
            if (distance < radius) {
                outputImage.bitmap.data[idx] = 0;     // R
                outputImage.bitmap.data[idx + 1] = 0; // G
                outputImage.bitmap.data[idx + 2] = 0; // B
                outputImage.bitmap.data[idx + 3] = 255; // Alpha
                pixelsModified++;
            }
        });
        console.log(`Background circle drawn, pixels modified: ${pixelsModified}`);

        outputImage.composite(image, 0, 0);

        outputImage.scan((x, y, idx) => {
            const distance = Math.sqrt(Math.pow(x - center, 2) + Math.pow(y - center, 2));
            if (distance >= radius) {
                outputImage.bitmap.data[idx + 3] = 0;
            }
        });

        console.log(`Writing favicon to: ${outputPath}`);
        // Jimp v1: write returns Promise<void>
        await outputImage.write(outputPath);
        console.log('Favicon generated successfully.');

    } catch (error) {
        console.error('Error generating favicon:', error);
    }
}

createCircularFavicon();

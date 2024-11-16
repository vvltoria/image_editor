const uploadInput = document.getElementById('upload');
const originalCanvas = document.getElementById('original-canvas');
const processedCanvas = document.getElementById('processed-canvas');

const sharpenBtn = document.getElementById('sharpen');
const thresholdMethodSelect = document.getElementById('threshold-method');
const applyThresholdBtn = document.getElementById('apply-threshold');

const adaptiveBlockSizeInput = document.getElementById('block-size');
const adaptiveConstantInput = document.getElementById('constant');
const applyAdaptiveThresholdBtn = document.getElementById('apply-adaptive-threshold');


let originalCtx = originalCanvas.getContext('2d');
let processedCtx = processedCanvas.getContext('2d');


let img = new Image();


uploadInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = function(event) {
        img.onload = function() {
            originalCanvas.width = img.width;
            originalCanvas.height = img.height;
            processedCanvas.width = img.width;
            processedCanvas.height = img.height;
            originalCtx.drawImage(img, 0, 0);
            processedCtx.drawImage(img, 0, 0);
        }
        img.src = event.target.result;
    }
    reader.readAsDataURL(file);
});


function getImageData(ctx, canvas) {
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

function setImageData(ctx, canvas, imageData) {
    ctx.putImageData(imageData, 0, 0);
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}


sharpenBtn.addEventListener('click', () => {
    let imageData = getImageData(originalCtx, originalCanvas);
    let data = imageData.data;
    let width = imageData.width;
    let height = imageData.height;


    let kernel = [
        0, -1, 0,
        -1, 5, -1,
        0, -1, 0
    ];

    let side = Math.round(Math.sqrt(kernel.length));
    let half = Math.floor(side / 2);

    let output = new Uint8ClampedArray(data.length);

    for(let y=0; y < height; y++) {
        for(let x=0; x < width; x++) {
            let r = 0, g = 0, b = 0;
            for(let ky=0; ky < side; ky++) {
                for(let kx=0; kx < side; kx++) {
                    let posX = x + kx - half;
                    let posY = y + ky - half;
                    if(posX >=0 && posX < width && posY >=0 && posY < height){
                        let pos = (posY * width + posX) * 4;
                        let weight = kernel[ky * side + kx];
                        r += data[pos] * weight;
                        g += data[pos +1] * weight;
                        b += data[pos +2] * weight;
                    }
                }
            }
            let pos = (y * width + x) *4;
            output[pos] = clamp(r, 0, 255);
            output[pos +1] = clamp(g, 0, 255);
            output[pos +2] = clamp(b, 0, 255);
            output[pos +3] = data[pos +3];
        }
    }

    let outputImageData = new ImageData(output, width, height);
    setImageData(processedCtx, processedCanvas, outputImageData);
});


applyThresholdBtn.addEventListener('click', () => {
    let method = thresholdMethodSelect.value;
    globalThreshold(method);
});

function globalThreshold(method) {
    let imageData = getImageData(originalCtx, originalCanvas);
    let data = imageData.data;
    let width = imageData.width;
    let height = imageData.height;


    let gray = [];
    for(let i=0; i < data.length; i+=4){
        let avg = 0.299*data[i] + 0.587*data[i+1] + 0.114*data[i+2];
        gray.push(avg);
    }


    let threshold;
    if(method === 'otsu') {
        threshold = otsuThreshold(gray, width * height);
    } else if(method === 'mean') {
        let sum = gray.reduce((a, b) => a + b, 0);
        threshold = sum / gray.length;
    }


    for(let i=0; i < data.length; i+=4){
        let val = gray[i/4] >= threshold ? 255 : 0;
        data[i] = data[i+1] = data[i+2] = val;
    }

    setImageData(processedCtx, processedCanvas, imageData);
}

function otsuThreshold(gray, total) {
    let histogram = new Array(256).fill(0);
    gray.forEach(val => {
        histogram[Math.floor(val)]++;
    });

    let sum = 0;
    for(let t=0; t<256; t++) sum += t * histogram[t];

    let sumB = 0;
    let wB = 0;
    let wF = 0;

    let varMax = 0;
    let threshold = 0;

    for(let t=0; t<256; t++) {
        wB += histogram[t];
        if(wB ===0) continue;
        wF = total - wB;
        if(wF ===0) break;

        sumB += t * histogram[t];
        let mB = sumB / wB;
        let mF = (sum - sumB) / wF;

        let varBetween = wB * wF * Math.pow(mB - mF, 2);

        if(varBetween > varMax){
            varMax = varBetween;
            threshold = t;
        }
    }
    return threshold;
}


applyAdaptiveThresholdBtn.addEventListener('click', () => {
    let blockSize = parseInt(adaptiveBlockSizeInput.value);
    let C = parseInt(adaptiveConstantInput.value);
    adaptiveThreshold(blockSize, C);
});

function adaptiveThreshold(blockSize, C) {
    if(blockSize % 2 === 0) {
        alert('Размер блока должен быть нечетным числом.');
        return;
    }

    let imageData = getImageData(originalCtx, originalCanvas);
    let data = imageData.data;
    let width = imageData.width;
    let height = imageData.height;


    let gray = [];
    for(let i=0; i < data.length; i+=4){
        let avg = 0.299*data[i] + 0.587*data[i+1] + 0.114*data[i+2];
        gray.push(avg);
    }


    let integral = new Array((width+1)*(height+1)).fill(0);
    for(let y=1; y<=height; y++) {
        for(let x=1; x<=width; x++) {
            integral[y*(width+1) + x] = gray[(y-1)*width + (x-1)] + integral[y*(width+1) + (x-1)] + integral[(y-1)*(width+1) + x] - integral[(y-1)*(width+1) + (x-1)];
        }
    }


    for(let y=0; y < height; y++) {
        for(let x=0; x < width; x++) {
            let x1 = Math.max(x - Math.floor(blockSize/2), 0);
            let y1 = Math.max(y - Math.floor(blockSize/2), 0);
            let x2 = Math.min(x + Math.floor(blockSize/2), width-1);
            let y2 = Math.min(y + Math.floor(blockSize/2), height-1);

            let count = (x2 - x1 +1) * (y2 - y1 +1);
            let sum = integral[(y2+1)*(width+1) + (x2+1)] - integral[(y2+1)*(width+1) + x1] - integral[y1*(width+1) + (x2+1)] + integral[y1*(width+1) + x1];
            let mean = sum / count;
            let threshold = mean - C;

            let pos = (y * width + x) *4;
            let val = gray[y*width + x] >= threshold ? 255 : 0;
            data[pos] = data[pos+1] = data[pos+2] = val;
        }
    }

    setImageData(processedCtx, processedCanvas, imageData);
}

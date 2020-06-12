

window.addEventListener('load', async () => {
    const videoElement = document.querySelector('[data-faceapi-video]');
    const container = document.querySelector('[data-faceapi-content]');
    const ironman = document.querySelector('[data-faceapi-overlay]');

    const startVideo = () => {
        console.log('Start Video Ready');
        navigator.getUserMedia = (navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia);
        navigator.getUserMedia(
            { video: {} },
            stream => videoElement.srcObject = stream,
            error => console.log(error)
        );
    }

    const loadModels = () => {
        console.log('Load Models');
        return Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
            faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
            faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
            faceapi.nets.faceExpressionNet.loadFromUri('/models'),
            faceapi.nets.ageGenderNet.loadFromUri('/models'),
        ]);
    }

    const getOverlayValues = landmarks => {
        const nose = landmarks.getNose()
        const jawline = landmarks.getJawOutline()

        const jawLeft = jawline[0]
        const jawRight = jawline.splice(-1)[0]
        const adjacent = jawRight.x - jawLeft.x
        const opposite = jawRight.y - jawLeft.y
        const jawLength = Math.sqrt(Math.pow(adjacent, 2) + Math.pow(opposite, 2))

        // Both of these work. The chat believes atan2 is better.
        // I don't know why. (It doesn’t break if we divide by zero.)
        // const angle = Math.round(Math.tan(opposite / adjacent) * 100)
        const angle = Math.atan2(opposite, adjacent) * (180 / Math.PI)
        const width = jawLength * 2.2

        return {
            width,
            angle,
            leftOffset: jawLeft.x - width * -0.4,
            topOffset: nose[0].y - width * 0.4,
        }
    }


    const drawMask = async (canvas, displaySize) => {
        const scale = 1;
        const detections = await faceapi.detectSingleFace(videoElement, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
        const overlayValues = getOverlayValues(detections.landmarks);
        ironman.style.cssText = `
                position: absolute;
                display: block;
                left: calc(${overlayValues.leftOffset * scale}px - 200px);
                top: calc(${overlayValues.topOffset * scale}px - 50px);
                width: ${overlayValues.width * scale}px;
                transform: rotate(${overlayValues.angle}deg);
            `
        canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    }

    const drawAllFaces = async (canvas, displaySize) => {
        const detections = await faceapi.detectAllFaces(videoElement, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceExpressions()
            .withAgeAndGender();

        const resizeDetections = faceapi.resizeResults(detections, displaySize);

        canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);

        faceapi.draw.drawDetections(canvas, resizeDetections);
        faceapi.draw.drawFaceLandmarks(canvas, resizeDetections);
        faceapi.draw.drawFaceExpressions(canvas, resizeDetections);

        resizeDetections.forEach(result => {
            const { age, gender, genderProbability } = result;
            new faceapi.draw.DrawTextField(
                [`${faceapi.utils.round(age, 0)} años`,
                `${gender} (${faceapi.utils.round(genderProbability)}) `],
                result.detection.box.bottomRight
            ).draw(canvas);
        })

    }


    try {
        await loadModels();
    }
    catch (error) {
        console.log(error);
    }


    startVideo();

    videoElement.addEventListener('play', () => {
        // Do something
        const canvas = faceapi.createCanvasFromMedia(videoElement);
        canvas.setAttribute('class', 'faceapi__canvas');
        container.appendChild(canvas);

        const displaySize = {
            width: videoElement.clientWidth,
            height: videoElement.clientHeight,
        }
        faceapi.matchDimensions(canvas, displaySize);

        setInterval( () => { 
            drawAllFaces(canvas, displaySize);
            // drawMask(canvas, displaySize);
        }, 100)

    })
})

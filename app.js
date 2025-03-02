// Main application code for a rotating wireframe cube with feedback

// Get the canvas element and initialize WebGL
const canvas = document.getElementById('glCanvas');
const gl = canvas.getContext('webgl');

if (!gl) {
    alert('Unable to initialize WebGL. Your browser may not support it.');
}

// Set up UI controls
const cubeRotationSlider = document.getElementById('cubeRotationSlider');
const cubeRotationValue = document.getElementById('cubeRotationValue');
const colorFadeSlider = document.getElementById('colorFadeSlider');
const colorFadeValue = document.getElementById('colorFadeValue');
const feedbackScaleSlider = document.getElementById('feedbackScaleSlider');
const feedbackScaleValue = document.getElementById('feedbackScaleValue');
const feedbackRotationSlider = document.getElementById('feedbackRotationSlider');
const feedbackRotationValue = document.getElementById('feedbackRotationValue');
const resetCubeButton = document.getElementById('resetCubeButton');

let cubeRotationSpeed = parseFloat(cubeRotationSlider.value);
let colorFadeSpeed = parseFloat(colorFadeSlider.value);
let feedbackScale = getNonLinearFeedbackScale(parseFloat(feedbackScaleSlider.value));
let feedbackRotation = parseFloat(feedbackRotationSlider.value);
let cubeRotation = 0.0; // Initial cube rotation
let startTime = Date.now(); // For time-based animation
let aspectRatio = 1.0; // Will be set during resize

// Non-linear scaling function for feedback scale
function getNonLinearFeedbackScale(linearValue) {
    // Normalize the value to [-1, 1] where 0 is the center (1.0)
    const centerValue = 1.0;
    const range = 0.3; // From 0.7 to 1.3 = 0.6, half of that is 0.3
    const normalizedValue = (linearValue - centerValue) / range;
    
    // Apply cubic function to make it more sensitive near center
    // Use a higher power for more extreme non-linearity (more sensitivity in the center)
    const power = 5; // Higher value = more sensitive in the center
    const signedValue = Math.sign(normalizedValue) * Math.pow(Math.abs(normalizedValue), power);
    
    // Convert back to the original range (will be more sensitive near 1.0)
    return centerValue + (signedValue * range);
}

// Inverse function to convert from actual scale to slider value
function getSliderValueFromScale(actualScale) {
    const centerValue = 1.0;
    const range = 0.3;
    const normalizedValue = (actualScale - centerValue) / range;
    
    // Inverse of the power function
    const power = 5;
    const linearNormalized = Math.sign(normalizedValue) * Math.pow(Math.abs(normalizedValue), 1/power);
    
    // Convert back to slider range
    return centerValue + (linearNormalized * range);
}

// Update displayed value to show the actual feedback scale
feedbackScaleValue.textContent = feedbackScale.toFixed(5);

cubeRotationSlider.addEventListener('input', function() {
    cubeRotationSpeed = parseFloat(this.value);
    cubeRotationValue.textContent = cubeRotationSpeed.toFixed(1);
});

colorFadeSlider.addEventListener('input', function() {
    colorFadeSpeed = parseFloat(this.value);
    colorFadeValue.textContent = colorFadeSpeed.toFixed(1);
});

feedbackScaleSlider.addEventListener('input', function() {
    // Apply non-linear scaling for finer control near 1.0
    feedbackScale = getNonLinearFeedbackScale(parseFloat(this.value));
    feedbackScaleValue.textContent = feedbackScale.toFixed(5);
});

feedbackRotationSlider.addEventListener('input', function() {
    feedbackRotation = parseFloat(this.value);
    feedbackRotationValue.textContent = feedbackRotation.toFixed(3);
});

// Add reset button functionality
resetCubeButton.addEventListener('click', function() {
    cubeRotation = 0.0;
    startTime = Date.now(); // Reset the time when cube is reset
    
    // Also reset feedback controls to their defaults
    feedbackScaleSlider.value = 1.0;
    feedbackScale = getNonLinearFeedbackScale(1.0);
    feedbackScaleValue.textContent = feedbackScale.toFixed(5);
    
    feedbackRotationSlider.value = 0.0;
    feedbackRotation = 0.0;
    feedbackRotationValue.textContent = "0.000";
    
    console.log("Cube rotation reset");
});

// Initialize the application
function init() {
    // Resize canvas to match window size
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Create shader programs
    const feedbackProgram = createShaderProgram(gl, feedbackVertexShaderSource, feedbackFragmentShaderSource);
    const cubeProgram = createShaderProgram(gl, cubeVertexShaderSource, cubeFragmentShaderSource);
    
    if (!feedbackProgram || !cubeProgram) {
        console.error('Failed to create shader programs');
        return;
    }
    
    // Set up feedback rendering
    const feedbackBuffers = createFeedbackBuffers();
    const feedbackProgramInfo = {
        program: feedbackProgram,
        attribLocations: {
            position: gl.getAttribLocation(feedbackProgram, 'aPosition'),
            texCoord: gl.getAttribLocation(feedbackProgram, 'aTexCoord')
        },
        uniformLocations: {
            texture: gl.getUniformLocation(feedbackProgram, 'uTexture'),
            scale: gl.getUniformLocation(feedbackProgram, 'uScale'),
            rotation: gl.getUniformLocation(feedbackProgram, 'uRotation'),
            aspectRatio: gl.getUniformLocation(feedbackProgram, 'uAspectRatio')
        }
    };
    
    // Set up cube rendering
    const cubeBuffers = createCubeBuffers();
    const cubeProgramInfo = {
        program: cubeProgram,
        attribLocations: {
            position: gl.getAttribLocation(cubeProgram, 'aPosition'),
            color: gl.getAttribLocation(cubeProgram, 'aColor')
        },
        uniformLocations: {
            projectionMatrix: gl.getUniformLocation(cubeProgram, 'uProjectionMatrix'),
            modelViewMatrix: gl.getUniformLocation(cubeProgram, 'uModelViewMatrix'),
            time: gl.getUniformLocation(cubeProgram, 'uTime'),
            colorSpeed: gl.getUniformLocation(cubeProgram, 'uColorSpeed')
        }
    };
    
    // Create framebuffers for ping-pong rendering
    const framebuffers = createFramebuffers();
    
    // Start the render loop
    let currentFramebuffer = 0;
    
    function render(now) {
        now *= 0.001; // Convert to seconds
        cubeRotation += cubeRotationSpeed*0.01;
        
        // Calculate elapsed time in seconds for color animation
        const timeInSeconds = (Date.now() - startTime) / 1000;
        
        // Ping-pong between framebuffers
        const sourceFramebuffer = framebuffers[currentFramebuffer];
        const targetFramebuffer = framebuffers[1 - currentFramebuffer];
        
        // First pass: render the previous frame with feedback effect to the target framebuffer
        gl.bindFramebuffer(gl.FRAMEBUFFER, targetFramebuffer.framebuffer);
        gl.viewport(0, 0, canvas.width, canvas.height);
        
        // Clear the framebuffer
        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        
        // Draw the previous frame with feedback effect
        gl.useProgram(feedbackProgramInfo.program);
        
        // Bind the position buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, feedbackBuffers.position);
        gl.vertexAttribPointer(
            feedbackProgramInfo.attribLocations.position,
            2, // 2 components per vertex
            gl.FLOAT,
            false,
            0,
            0
        );
        gl.enableVertexAttribArray(feedbackProgramInfo.attribLocations.position);
        
        // Bind the texture coordinate buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, feedbackBuffers.texCoord);
        gl.vertexAttribPointer(
            feedbackProgramInfo.attribLocations.texCoord,
            2, // 2 components per vertex
            gl.FLOAT,
            false,
            0,
            0
        );
        gl.enableVertexAttribArray(feedbackProgramInfo.attribLocations.texCoord);
        
        // Bind the texture from the source framebuffer
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, sourceFramebuffer.texture);
        gl.uniform1i(feedbackProgramInfo.uniformLocations.texture, 0);
        
        // Set the scale uniform
        gl.uniform1f(feedbackProgramInfo.uniformLocations.scale, feedbackScale);
        
        // Set the rotation uniform
        gl.uniform1f(feedbackProgramInfo.uniformLocations.rotation, feedbackRotation);
        
        // Set the aspect ratio uniform
        gl.uniform1f(feedbackProgramInfo.uniformLocations.aspectRatio, aspectRatio);
        
        // Draw the quad
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, feedbackBuffers.indices);
        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
        
        // Second pass: render the cube to the target framebuffer
        gl.useProgram(cubeProgramInfo.program);
        
        // Enable depth testing for 3D rendering
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);
        
        // Create the projection matrix
        const projectionMatrix = mat4.perspective(
            45 * Math.PI / 180, // Field of view
            canvas.width / canvas.height, // Aspect ratio
            0.1, // Near clipping plane
            100.0 // Far clipping plane
        );
        
        // Create the model-view matrix
        let modelViewMatrix = mat4.identity();
        
        // Apply translation to move the cube away from the camera
        modelViewMatrix = mat4.multiply(modelViewMatrix, mat4.translation(0.0, 0.0, -12.0));
        
        // Apply rotations
        modelViewMatrix = mat4.multiply(modelViewMatrix, mat4.zRotation(cubeRotation));
        
        // Set the uniforms
        gl.uniformMatrix4fv(
            cubeProgramInfo.uniformLocations.projectionMatrix,
            false,
            projectionMatrix
        );
        gl.uniformMatrix4fv(
            cubeProgramInfo.uniformLocations.modelViewMatrix,
            false,
            modelViewMatrix
        );
        
        // Set time uniform for color animation
        gl.uniform1f(cubeProgramInfo.uniformLocations.time, timeInSeconds);
        
        // Set color speed uniform
        gl.uniform1f(cubeProgramInfo.uniformLocations.colorSpeed, colorFadeSpeed);
        
        // Bind the position buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, cubeBuffers.position);
        gl.vertexAttribPointer(
            cubeProgramInfo.attribLocations.position,
            3, // 3 components per vertex
            gl.FLOAT,
            false,
            0,
            0
        );
        gl.enableVertexAttribArray(cubeProgramInfo.attribLocations.position);
        
        // Bind the color buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, cubeBuffers.color);
        gl.vertexAttribPointer(
            cubeProgramInfo.attribLocations.color,
            4, // 4 components per vertex
            gl.FLOAT,
            false,
            0,
            0
        );
        gl.enableVertexAttribArray(cubeProgramInfo.attribLocations.color);
        
        // Bind the index buffer for wireframe
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeBuffers.wireframeIndices);
        
        // Set line width for wireframe
        gl.lineWidth(2.0);
        
        // Draw the cube as wireframe
        gl.drawElements(gl.LINES, 48, gl.UNSIGNED_SHORT, 0);
        
        // Final pass: render the result to the canvas
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, canvas.width, canvas.height);
        
        // Clear the canvas
        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        
        // Draw the result from the target framebuffer
        gl.useProgram(feedbackProgramInfo.program);
        
        // Bind the position buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, feedbackBuffers.position);
        gl.vertexAttribPointer(
            feedbackProgramInfo.attribLocations.position,
            2,
            gl.FLOAT,
            false,
            0,
            0
        );
        gl.enableVertexAttribArray(feedbackProgramInfo.attribLocations.position);
        
        // Bind the texture coordinate buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, feedbackBuffers.texCoord);
        gl.vertexAttribPointer(
            feedbackProgramInfo.attribLocations.texCoord,
            2,
            gl.FLOAT,
            false,
            0,
            0
        );
        gl.enableVertexAttribArray(feedbackProgramInfo.attribLocations.texCoord);
        
        // Bind the texture from the target framebuffer
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, targetFramebuffer.texture);
        gl.uniform1i(feedbackProgramInfo.uniformLocations.texture, 0);
        
        // Set the scale to 1.0 for the final pass (no transformation)
        gl.uniform1f(feedbackProgramInfo.uniformLocations.scale, 1.0);
        
        // Set the rotation to 0.0 for the final pass (no rotation)
        gl.uniform1f(feedbackProgramInfo.uniformLocations.rotation, 0.0);
        
        // Set the aspect ratio uniform for the final pass
        gl.uniform1f(feedbackProgramInfo.uniformLocations.aspectRatio, aspectRatio);
        
        // Disable depth test temporarily
        gl.disable(gl.DEPTH_TEST);
        
        // Draw the quad
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, feedbackBuffers.indices);
        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
        
        // Swap framebuffers for the next frame
        currentFramebuffer = 1 - currentFramebuffer;
        
        // Request the next frame
        requestAnimationFrame(render);
    }
    
    // Start the render loop
    requestAnimationFrame(render);
}

// Create buffers for the feedback quad
function createFeedbackBuffers() {
    // Create a position buffer for a full-screen quad
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    const positions = [
        -1.0, -1.0,
         1.0, -1.0,
         1.0,  1.0,
        -1.0,  1.0
    ];
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
    
    // Create a texture coordinate buffer
    const texCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    const texCoords = [
        0.0, 0.0,
        1.0, 0.0,
        1.0, 1.0,
        0.0, 1.0
    ];
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texCoords), gl.STATIC_DRAW);
    
    // Create an index buffer
    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    const indices = [
        0, 1, 2,
        0, 2, 3
    ];
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
    
    return {
        position: positionBuffer,
        texCoord: texCoordBuffer,
        indices: indexBuffer
    };
}

// Create buffers for the 3D cube
function createCubeBuffers() {
    // Create a position buffer for the cube
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    const positions = [
        // Front face
        -1.0, -1.0,  1.0,
         1.0, -1.0,  1.0,
         1.0,  1.0,  1.0,
        -1.0,  1.0,  1.0,
        
        // Back face
        -1.0, -1.0, -1.0,
        -1.0,  1.0, -1.0,
         1.0,  1.0, -1.0,
         1.0, -1.0, -1.0,
        
        // Top face
        -1.0,  1.0, -1.0,
        -1.0,  1.0,  1.0,
         1.0,  1.0,  1.0,
         1.0,  1.0, -1.0,
        
        // Bottom face
        -1.0, -1.0, -1.0,
         1.0, -1.0, -1.0,
         1.0, -1.0,  1.0,
        -1.0, -1.0,  1.0,
        
        // Right face
         1.0, -1.0, -1.0,
         1.0,  1.0, -1.0,
         1.0,  1.0,  1.0,
         1.0, -1.0,  1.0,
        
        // Left face
        -1.0, -1.0, -1.0,
        -1.0, -1.0,  1.0,
        -1.0,  1.0,  1.0,
        -1.0,  1.0, -1.0
    ];
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
    
    // Create a color buffer
    const colorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    const colors = [
        // Front face: white
        1.0, 1.0, 1.0, 1.0,
        1.0, 1.0, 1.0, 1.0,
        1.0, 1.0, 1.0, 1.0,
        1.0, 1.0, 1.0, 1.0,
        
        // Back face: red
        1.0, 0.0, 0.0, 1.0,
        1.0, 0.0, 0.0, 1.0,
        1.0, 0.0, 0.0, 1.0,
        1.0, 0.0, 0.0, 1.0,
        
        // Top face: green
        0.0, 1.0, 0.0, 1.0,
        0.0, 1.0, 0.0, 1.0,
        0.0, 1.0, 0.0, 1.0,
        0.0, 1.0, 0.0, 1.0,
        
        // Bottom face: blue
        0.0, 0.0, 1.0, 1.0,
        0.0, 0.0, 1.0, 1.0,
        0.0, 0.0, 1.0, 1.0,
        0.0, 0.0, 1.0, 1.0,
        
        // Right face: yellow
        1.0, 1.0, 0.0, 1.0,
        1.0, 1.0, 0.0, 1.0,
        1.0, 1.0, 0.0, 1.0,
        1.0, 1.0, 0.0, 1.0,
        
        // Left face: cyan
        0.0, 1.0, 1.0, 1.0,
        0.0, 1.0, 1.0, 1.0,
        0.0, 1.0, 1.0, 1.0,
        0.0, 1.0, 1.0, 1.0
    ];
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);
    
    // Create an index buffer for wireframe
    const wireframeIndexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, wireframeIndexBuffer);
    const wireframeIndices = [
        // Front face
        0, 1, 1, 2, 2, 3, 3, 0,
        // Back face
        4, 5, 5, 6, 6, 7, 7, 4,
        // Top face
        8, 9, 9, 10, 10, 11, 11, 8,
        // Bottom face
        12, 13, 13, 14, 14, 15, 15, 12,
        // Right face
        16, 17, 17, 18, 18, 19, 19, 16,
        // Left face
        20, 21, 21, 22, 22, 23, 23, 20,
        // Connect faces
        0, 4, 1, 7, 2, 6, 3, 5
    ];
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(wireframeIndices), gl.STATIC_DRAW);
    
    return {
        position: positionBuffer,
        color: colorBuffer,
        wireframeIndices: wireframeIndexBuffer
    };
}

// Create framebuffers for ping-pong rendering
function createFramebuffers() {
    const framebuffers = [];
    
    for (let i = 0; i < 2; i++) {
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            canvas.width,
            canvas.height,
            0,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            null
        );
        
        // Set texture parameters
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        
        // Create a framebuffer
        const framebuffer = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        
        // Attach the texture to the framebuffer
        gl.framebufferTexture2D(
            gl.FRAMEBUFFER,
            gl.COLOR_ATTACHMENT0,
            gl.TEXTURE_2D,
            texture,
            0
        );
        
        // Create a renderbuffer for depth
        const depthBuffer = gl.createRenderbuffer();
        gl.bindRenderbuffer(gl.RENDERBUFFER, depthBuffer);
        gl.renderbufferStorage(
            gl.RENDERBUFFER,
            gl.DEPTH_COMPONENT16,
            canvas.width,
            canvas.height
        );
        
        // Attach the depth buffer to the framebuffer
        gl.framebufferRenderbuffer(
            gl.FRAMEBUFFER,
            gl.DEPTH_ATTACHMENT,
            gl.RENDERBUFFER,
            depthBuffer
        );
        
        // Check if the framebuffer is complete
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
            console.error('Framebuffer is not complete');
        }
        
        framebuffers.push({
            framebuffer: framebuffer,
            texture: texture,
            depthBuffer: depthBuffer
        });
    }
    
    // Unbind the framebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    
    return framebuffers;
}

// Resize the canvas to match the window size
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
    
    // Calculate and update the aspect ratio
    aspectRatio = canvas.width / canvas.height;
    
    // Update framebuffer textures if they exist
    if (typeof updateFramebuffers === 'function') {
        updateFramebuffers();
    }
}

// Initialize the application when the page loads
window.onload = init;

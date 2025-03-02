// Shader code for our WebGL application

// Vertex shader for rendering the feedback effect
const feedbackVertexShaderSource = `
attribute vec4 aPosition;
attribute vec2 aTexCoord;
varying vec2 vTexCoord;

void main() {
    gl_Position = aPosition;
    vTexCoord = aTexCoord;
}`;

// Fragment shader for the feedback effect
const feedbackFragmentShaderSource = `
precision mediump float;
varying vec2 vTexCoord;
uniform sampler2D uTexture;
uniform float uScale;
uniform float uRotation;
uniform float uAspectRatio;

void main() {
    // Center point for transformations
    vec2 center = vec2(0.5, 0.5);
    
    // Move coordinates to be centered at the origin
    vec2 texCoord = vTexCoord - center;
    
    // Account for aspect ratio before rotation
    texCoord.x *= uAspectRatio;
    
    // Apply rotation
    float cosAngle = cos(uRotation);
    float sinAngle = sin(uRotation);
    vec2 rotatedCoord = vec2(
        texCoord.x * cosAngle - texCoord.y * sinAngle,
        texCoord.x * sinAngle + texCoord.y * cosAngle
    );
    
    // Remove aspect ratio correction after rotation
    rotatedCoord.x /= uAspectRatio;
    
    // Apply scaling
    rotatedCoord = rotatedCoord / uScale;
    
    // Move back to original coordinate space
    rotatedCoord = rotatedCoord + center;
    
    // Sample the texture with transformations applied
    if(rotatedCoord.x >= 0.0 && rotatedCoord.x <= 1.0 && rotatedCoord.y >= 0.0 && rotatedCoord.y <= 1.0) {
        gl_FragColor = texture2D(uTexture, rotatedCoord);
    } else {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    }
}`;

// Vertex shader for rendering the 3D cube
const cubeVertexShaderSource = `
attribute vec4 aPosition;
attribute vec4 aColor;
uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;
uniform float uTime;
varying vec4 vColor;

void main() {
    gl_Position = uProjectionMatrix * uModelViewMatrix * aPosition;
    // Pass the position attribute to the fragment shader to use in coloring
    vColor = aPosition;
}`;

// Fragment shader for the 3D cube
const cubeFragmentShaderSource = `
precision mediump float;
varying vec4 vColor;
uniform float uTime;
uniform float uColorSpeed;

// HSV to RGB conversion function
vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
    // Create a color that cycles through hue values based on time
    float hue = fract(uTime * uColorSpeed);
    vec3 hsv = vec3(hue, 1.0, 1.0); // Full saturation and value
    vec3 rgb = hsv2rgb(hsv);
    
    // Set the fragment color to the computed RGB color with full opacity
    gl_FragColor = vec4(rgb, 1.0);
}`;

// Function to compile a shader
function compileShader(gl, source, type) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader compilation error:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    
    return shader;
}

// Function to create a shader program
function createShaderProgram(gl, vertexShaderSource, fragmentShaderSource) {
    const vertexShader = compileShader(gl, vertexShaderSource, gl.VERTEX_SHADER);
    const fragmentShader = compileShader(gl, fragmentShaderSource, gl.FRAGMENT_SHADER);
    
    if (!vertexShader || !fragmentShader) {
        return null;
    }
    
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Program linking error:', gl.getProgramInfoLog(program));
        gl.deleteProgram(program);
        return null;
    }
    
    return program;
}

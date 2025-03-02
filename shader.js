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

// Prismatic colormap - inspired by light dispersion through a prism with enhanced contrast
vec3 prismatic(float t) {
    // Use a mathematical formula to create a colormap with sharp transitions
    // between pure spectral colors, reminiscent of light through a prism
    
    t = fract(t); // Ensure wrapping
    float x = 6.0 * t; // 6 color segments
    int i = int(x);
    float f = x - float(i); // Fractional part
    
    // Apply ease function to create sharper transitions
    f = 0.5 - 0.5 * cos(f * 3.14159);
    
    vec3 color;
    
    if (i == 0) {
        // Red to Yellow
        color = vec3(1.0, f, 0.0);
    } else if (i == 1) {
        // Yellow to Green
        color = vec3(1.0 - f, 1.0, 0.0);
    } else if (i == 2) {
        // Green to Cyan
        color = vec3(0.0, 1.0, f);
    } else if (i == 3) {
        // Cyan to Blue
        color = vec3(0.0, 1.0 - f, 1.0);
    } else if (i == 4) {
        // Blue to Magenta
        color = vec3(f, 0.0, 1.0);
    } else {
        // Magenta to Red
        color = vec3(1.0, 0.0, 1.0 - f);
    }
    
    // Add subtle luminance variation for more depth
    float luminance = 0.9 + 0.1 * sin(t * 12.0);
    color *= luminance;
    
    return color;
}

void main() {
    // Create a color that cycles based on time
    float t = fract(uTime * uColorSpeed);
    
    // Use the prismatic colormap instead of HSV
    vec3 rgb = prismatic(t);
    
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

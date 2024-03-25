// Import the React library for building the component
import React from 'react';

// Define the shape of props passed to the Pixel component using an interface
interface PixelProps {
  pixel: {
    x: number; // The x coordinate of the pixel
    y: number; // The y coordinate of the pixel
    color: string; // The color of the pixel
    owner: string; // The owner of the pixel
    price: bigint; // The price of the pixel
  };
  isSelected: boolean; // Flag indicating if the pixel is selected
  onClick: (e: React.MouseEvent<HTMLDivElement>, pixel: PixelProps['pixel']) => void; // Function to handle click events on the pixel
  onEnter: (pixel: PixelProps['pixel']) => void; // Function to handle mouse enter events over the pixel
}

// The Pixel component, memoized with React.memo for performance optimization. It re-renders only if props change.
const Pixel: React.FC<PixelProps> = React.memo(({ pixel, isSelected, onClick, onEnter }) => {
  return (
    <div
      className="pixel" // CSS class for styling the pixel
      style={{
        backgroundColor: pixel.color, // Set the background color to the pixel's color
        border: isSelected ? '1px solid red' : `1px solid ${pixel.color}`, // Highlight the border in red if selected
        boxShadow: isSelected ? '0 0 2px red' : 'none', // Apply a shadow effect if selected
      }}
      title={`Owner: ${pixel.owner} | Price: ${pixel.price} MAS`} // Tooltip showing the pixel's owner and price
      onMouseDown={(e) => onClick(e, pixel)} // Handle mouse down events
      onMouseEnter={() => onEnter(pixel)} // Handle mouse enter events
    />
  );
});

// Export the Pixel component for use in other parts of the application
export default Pixel;

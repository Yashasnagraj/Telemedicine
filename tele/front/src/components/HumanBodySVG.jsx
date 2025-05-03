import React, { useEffect, useState } from 'react';
import './HumanBodySVG.css';

const HumanBodySVG = ({ painRegions = [] }) => {
  const [highlightedRegions, setHighlightedRegions] = useState({});

  useEffect(() => {
    // Update highlighted regions when painRegions changes
    console.log('HumanBodySVG: painRegions updated:', painRegions);
    
    const newHighlights = {};
    
    if (Array.isArray(painRegions)) {
      painRegions.forEach(region => {
        if (region && region.region) {
          newHighlights[region.region] = {
            intensity: region.intensity || 0.5,
            description: region.description || ''
          };
          console.log(`HumanBodySVG: Added region ${region.region} with intensity ${region.intensity}`);
        } else {
          console.warn('HumanBodySVG: Invalid region object:', region);
        }
      });
    } else {
      console.warn('HumanBodySVG: painRegions is not an array:', painRegions);
    }
    
    console.log('HumanBodySVG: Setting highlighted regions:', newHighlights);
    setHighlightedRegions(newHighlights);
  }, [painRegions]);

  // Function to get fill color based on intensity
  const getFillColor = (regionId) => {
    if (!highlightedRegions[regionId]) return 'none';
    
    const intensity = highlightedRegions[regionId].intensity;
    // Return a red color with opacity based on intensity
    return `rgba(255, 0, 0, ${Math.min(intensity, 0.8)})`;
  };

  // Function to get stroke color based on intensity
  const getStrokeColor = (regionId) => {
    if (!highlightedRegions[regionId]) return '#000';
    
    const intensity = highlightedRegions[regionId].intensity;
    // Return a red stroke if region is highlighted
    return intensity > 0 ? '#ff0000' : '#000';
  };

  // Function to get stroke width based on intensity
  const getStrokeWidth = (regionId) => {
    if (!highlightedRegions[regionId]) return 1;
    
    const intensity = highlightedRegions[regionId].intensity;
    // Return a thicker stroke if region is highlighted
    return intensity > 0 ? 2 : 1;
  };

  return (
    <div className="human-body-svg-container">
      <svg
        viewBox="0 0 200 400"
        xmlns="http://www.w3.org/2000/svg"
        className="human-body-svg"
      >
        {/* Head */}
        <circle
          id="head"
          cx="100"
          cy="50"
          r="30"
          fill={getFillColor('head')}
          stroke={getStrokeColor('head')}
          strokeWidth={getStrokeWidth('head')}
        />
        
        {/* Face features */}
        <ellipse
          id="right_eye"
          cx="85"
          cy="40"
          rx="5"
          ry="3"
          fill={getFillColor('right_eye')}
          stroke={getStrokeColor('right_eye')}
          strokeWidth={getStrokeWidth('right_eye')}
        />
        
        <ellipse
          id="left_eye"
          cx="115"
          cy="40"
          rx="5"
          ry="3"
          fill={getFillColor('left_eye')}
          stroke={getStrokeColor('left_eye')}
          strokeWidth={getStrokeWidth('left_eye')}
        />
        
        <path
          id="nose"
          d="M100,45 L100,55 M95,55 L100,55 L105,55"
          fill="none"
          stroke={getStrokeColor('nose')}
          strokeWidth={getStrokeWidth('nose')}
        />
        
        <path
          id="mouth"
          d="M90,60 C95,65 105,65 110,60"
          fill="none"
          stroke="#000"
          strokeWidth="1"
        />
        
        <path
          id="jaw"
          d="M80,60 C90,75 110,75 120,60"
          fill={getFillColor('jaw')}
          stroke={getStrokeColor('jaw')}
          strokeWidth={getStrokeWidth('jaw')}
          fillOpacity="0.5"
        />
        
        <path
          id="right_cheek"
          d="M80,50 Q85,55 80,60"
          fill={getFillColor('right_cheek')}
          stroke={getStrokeColor('right_cheek')}
          strokeWidth={getStrokeWidth('right_cheek')}
          fillOpacity="0.5"
        />
        
        <path
          id="left_cheek"
          d="M120,50 Q115,55 120,60"
          fill={getFillColor('left_cheek')}
          stroke={getStrokeColor('left_cheek')}
          strokeWidth={getStrokeWidth('left_cheek')}
          fillOpacity="0.5"
        />
        
        {/* Neck */}
        <rect
          id="neck"
          x="90"
          y="80"
          width="20"
          height="20"
          fill="none"
          stroke="#000"
          strokeWidth="1"
        />
        
        {/* Torso */}
        <path
          id="torso"
          d="M70,100 L130,100 L140,200 L60,200 Z"
          fill="none"
          stroke="#000"
          strokeWidth="1"
        />
        
        {/* Chest */}
        <path
          id="chest"
          d="M70,100 C90,120 110,120 130,100"
          fill={getFillColor('chest')}
          stroke={getStrokeColor('chest')}
          strokeWidth={getStrokeWidth('chest')}
          fillOpacity="0.5"
        />
        
        {/* Abdomen */}
        <path
          id="abdomen"
          d="M70,130 L130,130 L135,170 L65,170 Z"
          fill={getFillColor('abdomen')}
          stroke={getStrokeColor('abdomen')}
          strokeWidth={getStrokeWidth('abdomen')}
          fillOpacity="0.5"
        />
        
        {/* Pelvis */}
        <path
          id="pelvis"
          d="M65,170 L135,170 L140,200 L60,200 Z"
          fill={getFillColor('pelvis')}
          stroke={getStrokeColor('pelvis')}
          strokeWidth={getStrokeWidth('pelvis')}
          fillOpacity="0.5"
        />
        
        {/* Arms */}
        <path
          id="right_arm"
          d="M70,100 L40,150 L45,200"
          fill="none"
          stroke={getStrokeColor('right_arm')}
          strokeWidth={getStrokeWidth('right_arm')}
        />
        
        <path
          id="left_arm"
          d="M130,100 L160,150 L155,200"
          fill="none"
          stroke={getStrokeColor('left_arm')}
          strokeWidth={getStrokeWidth('left_arm')}
        />
        
        {/* Hands */}
        <circle
          id="right_hand"
          cx="45"
          cy="205"
          r="8"
          fill={getFillColor('right_hand')}
          stroke={getStrokeColor('right_hand')}
          strokeWidth={getStrokeWidth('right_hand')}
        />
        
        <circle
          id="left_hand"
          cx="155"
          cy="205"
          r="8"
          fill={getFillColor('left_hand')}
          stroke={getStrokeColor('left_hand')}
          strokeWidth={getStrokeWidth('left_hand')}
        />
        
        {/* Legs */}
        <path
          id="right_leg"
          d="M80,200 L70,300 L80,350"
          fill="none"
          stroke={getStrokeColor('right_leg')}
          strokeWidth={getStrokeWidth('right_leg')}
        />
        
        <path
          id="left_leg"
          d="M120,200 L130,300 L120,350"
          fill="none"
          stroke={getStrokeColor('left_leg')}
          strokeWidth={getStrokeWidth('left_leg')}
        />
        
        {/* Feet */}
        <path
          id="right_foot"
          d="M80,350 L60,360 L80,365 L80,350"
          fill={getFillColor('right_foot')}
          stroke={getStrokeColor('right_foot')}
          strokeWidth={getStrokeWidth('right_foot')}
        />
        
        <path
          id="left_foot"
          d="M120,350 L140,360 L120,365 L120,350"
          fill={getFillColor('left_foot')}
          stroke={getStrokeColor('left_foot')}
          strokeWidth={getStrokeWidth('left_foot')}
        />
      </svg>
      
      {/* Pain region descriptions */}
      <div className="pain-descriptions">
        {Object.entries(highlightedRegions).map(([region, data]) => (
          data.intensity > 0 && (
            <div key={region} className="pain-description-item">
              <div 
                className="pain-indicator" 
                style={{ backgroundColor: `rgba(255, 0, 0, ${Math.min(data.intensity, 0.8)})` }}
              />
              <span className="pain-region">{region.replace('_', ' ')}</span>
              {data.description && (
                <span className="pain-detail">: {data.description}</span>
              )}
            </div>
          )
        ))}
      </div>
    </div>
  );
};

export default HumanBodySVG;
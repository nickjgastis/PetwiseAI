import React from "react";
import "../styles/LoaderPuppy.css";

const LoaderPuppy = () => {
    return (
        <div className="puppy-loader-container">
            <div className="puppy-loader">
                <div className="puppy-head">
                    <div className="puppy-ears ears-left"></div>
                    <div className="puppy-ears ears-right"></div>
                    <div className="puppy-eyes"></div>
                    <div className="puppy-mouth">
                        <div className="puppy-nose"></div>
                        <div className="puppy-tongue"></div>
                    </div>
                </div>
                <div className="puppy-tail"></div>
                <div className="puppy-body">
                    <div className="puppy-foot"></div>
                </div>
                <div className="puppy-ball"></div>
            </div>
        </div>
    );
};

export default LoaderPuppy;

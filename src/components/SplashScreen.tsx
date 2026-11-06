"use client";

import React from "react";

interface SplashScreenProps {
  fadingOut?: boolean;
}

export function SplashScreen({ fadingOut = false }: SplashScreenProps) {
  return (
    <div
      className={`splash-screen ${fadingOut ? "splash-screen--fade-out" : ""}`}
      role="status"
      aria-label="Animação CupomHub"
    >
      <div className="scene">
        {/* Parte 1: Bolinhas com efeito Gooey */}
        <div className="goo-container">
          <div className="dot dot-1"></div>
          <div className="dot dot-2"></div>
          <div className="dot dot-3"></div>
        </div>

        {/* Parte 2: MacBook com o texto na tela */}
        <div className="macbook">
          <div className="macbook__topBord">
            <div className="macbook__display">
              <span className="screen-text">
                De olho
                <br />
                na nota
              </span>
              <div className="macbook__load"></div>
            </div>
          </div>
          <div className="macbook__underBord">
            <div className="macbook__keybord">
              <div className="keybord">
                <div className="keybord__touchbar"></div>
                <ul className="keybord__keyBox">
                  <li className="keybord__key key--01"></li>
                  <li className="keybord__key key--02"></li>
                  <li className="keybord__key key--03"></li>
                  <li className="keybord__key key--04"></li>
                  <li className="keybord__key key--05"></li>
                  <li className="keybord__key key--06"></li>
                  <li className="keybord__key key--07"></li>
                  <li className="keybord__key key--08"></li>
                  <li className="keybord__key key--09"></li>
                  <li className="keybord__key key--10"></li>
                  <li className="keybord__key key--11"></li>
                  <li className="keybord__key key--12"></li>
                  <li className="keybord__key key--13"></li>
                </ul>
                <ul className="keybord__keyBox--under">
                  <li className="keybord__key key--14"></li>
                  <li className="keybord__key key--15"></li>
                  <li className="keybord__key key--16"></li>
                  <li className="keybord__key key--17"></li>
                  <li className="keybord__key key--18"></li>
                  <li className="keybord__key key--19"></li>
                  <li className="keybord__key key--20"></li>
                  <li className="keybord__key key--21"></li>
                  <li className="keybord__key key--22"></li>
                  <li className="keybord__key key--23"></li>
                  <li className="keybord__key key--24"></li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      <svg className="svg-filters" version="1.1" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="goo">
            <feGaussianBlur result="blur" stdDeviation="10" in="SourceGraphic"></feGaussianBlur>
            <feColorMatrix
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 21 -7"
              mode="matrix"
              in="blur"
            ></feColorMatrix>
          </filter>
        </defs>
      </svg>
    </div>
  );
}

export default SplashScreen;

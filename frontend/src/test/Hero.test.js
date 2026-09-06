import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

import Hero from '../landing/home/Hero';

//Test Suite
describe('Hero Component', () => {
    // Test Case 1
    test('Renders Hero Image', () => {
        render(
            <BrowserRouter>
                <Hero />
            </BrowserRouter>
        );
        const heroImage = screen.getByAltText(/TradePulse Paper Trading Platform|Landing Image/i);
        expect(heroImage).toBeInTheDocument();
        expect(heroImage).toHaveAttribute('src', expect.stringContaining('landing.png'));
    });
});
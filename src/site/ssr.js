import React, { Suspense } from 'react';
import { renderToString } from 'react-dom/server';
import { Route, Routes } from 'react-router-dom';
import { StaticRouter } from 'react-router-dom/server';
import { SeoContext } from './seo';
import { SITE_PAGES } from './routes';
import * as Pages from './pages';

// Mirrors the DOM the client renders in App.js (wrapper div > route element in
// a Suspense boundary) so hydration lines up.
export const renderSitePage = (url) => {
    const collector = {};
    const html = renderToString(
        <SeoContext.Provider value={collector}>
            <StaticRouter location={url}>
                <div>
                    <Routes>
                        {SITE_PAGES.map(({ path, page }) => {
                            const Page = Pages[page];
                            return (
                                <Route
                                    key={path}
                                    path={path}
                                    element={
                                        <Suspense fallback={null}>
                                            <Page />
                                        </Suspense>
                                    }
                                />
                            );
                        })}
                    </Routes>
                </div>
            </StaticRouter>
        </SeoContext.Provider>
    );
    return { html, meta: collector.meta };
};

import { lazy } from 'react';

const page = (load) => lazy(load);

export const LAZY_PAGES = {
    Home: page(() => import(/* webpackChunkName: "site" */ './pages/Home')),
    Dictation: page(() => import(/* webpackChunkName: "site" */ './pages/Dictation')),
    ClinicalAssistant: page(() => import(/* webpackChunkName: "site" */ './pages/ClinicalAssistant')),
    Features: page(() => import(/* webpackChunkName: "site" */ './pages/Features')),
    Pricing: page(() => import(/* webpackChunkName: "site" */ './pages/Pricing')),
    Students: page(() => import(/* webpackChunkName: "site" */ './pages/Students')),
    About: page(() => import(/* webpackChunkName: "site" */ './pages/About')),
    Demo: page(() => import(/* webpackChunkName: "site" */ './pages/Demo')),
    Help: page(() => import(/* webpackChunkName: "site" */ './pages/Help')),
    Updates: page(() => import(/* webpackChunkName: "site" */ './pages/Updates')),
    Install: page(() => import(/* webpackChunkName: "site" */ './pages/Install')),
    Blog: page(() => import(/* webpackChunkName: "site-blog" */ './pages/Blog')),
    BlogPost: page(() => import(/* webpackChunkName: "site-blog" */ './pages/BlogPost')),
    Privacy: page(() => import(/* webpackChunkName: "site" */ './pages/Privacy')),
    Terms: page(() => import(/* webpackChunkName: "site" */ './pages/Terms'))
};

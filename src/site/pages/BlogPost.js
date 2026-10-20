import React from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';
import SiteLayout from '../SiteLayout';
import { Seo, articleLd } from '../seo';
import { POSTS, POST_REDIRECTS } from '../../content/blog/posts.generated';
import { Container, CtaBand, Reveal } from '../ui';
import { PostCard, formatDate } from './Blog';
import { AUTHOR_PHOTOS } from '../siteConfig';

const BlogPost = () => {
    const { slug } = useParams();
    const post = POSTS.find((p) => p.slug === slug);

    if (!post) {
        const moved = POST_REDIRECTS[slug];
        return <Navigate to={moved ? `/blog/${moved}` : '/blog'} replace />;
    }

    const related = POSTS.filter((p) => p.slug !== post.slug).slice(0, 3);

    return (
        <SiteLayout>
            <Seo
                title={`${post.title} | PetWise Blog`}
                description={post.description}
                path={`/blog/${post.slug}`}
                image={post.cover || undefined}
                type="article"
                jsonLd={articleLd(post)}
            />
            <article className="bg-white">
                <Container className="pt-12 sm:pt-20">
                    <div className="max-w-3xl mx-auto">
                        <Link to="/blog" className="inline-flex items-center gap-2 text-[14px] text-[#13233f]/55 hover:text-[#13233f] transition-colors">
                            <FiArrowLeft aria-hidden /> All articles
                        </Link>
                        <h1 className="mt-8 text-[2.3rem] sm:text-[3.25rem] leading-[1.06] font-semibold tracking-[-0.035em] text-[#13233f]">
                            {post.title}
                        </h1>
                        {post.description && <p className="mt-6 text-lg sm:text-xl leading-relaxed text-[#1a2b4a]/60">{post.description}</p>}
                        <div className="mt-8 flex items-center gap-3 text-[14px] text-[#1a2b4a]/50">
                            {AUTHOR_PHOTOS[post.author] && (
                                <img src={AUTHOR_PHOTOS[post.author]} alt={post.author} className="w-9 h-9 rounded-full object-cover" />
                            )}
                            <span>
                                <span className="text-[#13233f]/80 font-medium">{post.author}</span> · {formatDate(post.date)} · {post.readingMinutes} min read
                            </span>
                        </div>
                    </div>
                </Container>
                {post.cover && (
                    <div className="mt-12 px-3 sm:px-5">
                        <div className="max-w-5xl mx-auto overflow-hidden rounded-[28px] aspect-[16/9] bg-[#f6f8fb]">
                            <img src={post.cover} alt="" className="w-full h-full object-cover" />
                        </div>
                    </div>
                )}
                <Container className="py-16 sm:py-20">
                    <div className="site-prose max-w-[680px] mx-auto" dangerouslySetInnerHTML={{ __html: post.html }} />
                </Container>
            </article>

            {related.length > 0 && (
                <section className="bg-[#f6f8fb] py-20 sm:py-24">
                    <Container>
                        <h2 className="text-[1.75rem] font-semibold tracking-[-0.02em] text-[#13233f]">Keep reading</h2>
                        <div className="mt-10 grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
                            {related.map((p, i) => (
                                <Reveal key={p.slug} delay={i * 70}>
                                    <PostCard post={p} />
                                </Reveal>
                            ))}
                        </div>
                    </Container>
                </section>
            )}
            <div className="pt-3 sm:pt-5 bg-white">
                <CtaBand />
            </div>
        </SiteLayout>
    );
};

export default BlogPost;

import React from 'react';
import { Link } from 'react-router-dom';
import SiteLayout from '../SiteLayout';
import { Seo } from '../seo';
import { POSTS } from '../../content/blog/posts.generated';
import { Container, CtaBand, Hero, Highlight, Reveal } from '../ui';

export const formatDate = (iso) =>
    new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });

export const PostCard = ({ post, large = false }) => (
    <Link to={`/blog/${post.slug}`} className="group block h-full">
        <article className={`h-full flex flex-col ${large ? 'lg:grid lg:grid-cols-12 lg:gap-12 lg:items-center' : ''}`}>
            <div className={`overflow-hidden rounded-[24px] bg-[#f6f8fb] ${large ? 'lg:col-span-7 aspect-[16/10]' : 'aspect-[16/10]'}`}>
                {post.cover ? (
                    <img
                        src={post.cover}
                        alt=""
                        loading="lazy"
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                    />
                ) : (
                    <div className="w-full h-full bg-[linear-gradient(135deg,#e9f6fd,#f6f8fb)]" />
                )}
            </div>
            <div className={large ? 'mt-7 lg:mt-0 lg:col-span-5' : 'mt-6 flex-1 flex flex-col'}>
                <p className="text-[13px] text-[#1a2b4a]/45">
                    {formatDate(post.date)} · {post.readingMinutes} min read
                </p>
                <h2
                    className={`mt-3 font-semibold tracking-[-0.02em] text-[#13233f] group-hover:text-[#3468bd] transition-colors ${
                        large ? 'text-[1.9rem] sm:text-[2.4rem] leading-[1.12]' : 'text-xl leading-snug'
                    }`}
                >
                    {post.title}
                </h2>
                {post.description && (
                    <p className={`mt-3 text-[#1a2b4a]/60 leading-relaxed ${large ? 'text-lg' : 'text-[15px] line-clamp-3'}`}>{post.description}</p>
                )}
            </div>
        </article>
    </Link>
);

const Blog = () => {
    const [featured, ...rest] = POSTS;
    return (
        <SiteLayout overlayHeader>
            <Seo
                title="Blog | Veterinary AI, SOAP Notes and Clinic Workflow | PetWise"
                description="Practical articles for veterinarians on AI scribes, faster SOAP notes, dictation, clinical workflow and getting home on time."
                path="/blog"
            />
            <Hero
                eyebrow="Blog"
                title={
                    <>
                        Notes from <Highlight>the clinic.</Highlight>
                    </>
                }
                body="Ideas on AI in veterinary medicine, faster records and protecting your time."
            />
            <section className="bg-white">
                <Container className="pt-16 sm:pt-20 pb-24 sm:pb-32">
                    {featured && (
                        <Reveal>
                            <PostCard post={featured} large />
                        </Reveal>
                    )}

                    <div className="mt-20 grid gap-x-8 gap-y-16 sm:grid-cols-2 lg:grid-cols-3">
                        {rest.map((post, i) => (
                            <Reveal key={post.slug} delay={(i % 3) * 70}>
                                <PostCard post={post} />
                            </Reveal>
                        ))}
                    </div>
                </Container>
            </section>
            <CtaBand />
        </SiteLayout>
    );
};

export default Blog;

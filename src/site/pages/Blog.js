import React from 'react';
import { Link } from 'react-router-dom';
import SiteLayout from '../SiteLayout';
import { Seo } from '../seo';
import { POSTS } from '../../content/blog/posts.generated';
import { Container, CtaBand, Reveal } from '../ui';

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
        <SiteLayout>
            <Seo
                title="Blog | Veterinary AI, SOAP Notes and Clinic Workflow | PetWise"
                description="Practical articles for veterinarians on AI scribes, faster SOAP notes, dictation, clinical workflow and getting home on time."
                path="/blog"
            />
            <section className="bg-white">
                <Container className="pt-14 sm:pt-24 pb-24 sm:pb-32">
                    <div className="max-w-3xl">
                        <p className="text-[13px] font-semibold tracking-[0.14em] uppercase text-[#3468bd] mb-4">Blog</p>
                        <h1 className="text-[2.75rem] sm:text-[4rem] leading-[1.02] font-semibold tracking-[-0.04em] text-[#13233f]">
                            Notes from the clinic.
                        </h1>
                        <p className="mt-6 text-lg sm:text-xl text-[#1a2b4a]/65">
                            Ideas on AI in veterinary medicine, faster records and protecting your time.
                        </p>
                    </div>

                    {featured && (
                        <Reveal className="mt-16 sm:mt-20">
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

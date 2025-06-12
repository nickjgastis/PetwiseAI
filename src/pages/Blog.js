import React, { useEffect, useState } from 'react';
import axios from 'axios';
import '../styles/Blog.css';

const HASHNODE_API = 'https://gql.hashnode.com';

const Blog = () => {
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        let isMounted = true;

        const fetchPosts = async () => {
            try {
                const query = `
                query GetPosts {
                    publication(host: "blog.petwise.vet") {
                        posts(first: 50) {
                            edges {
                                node {
                                    title
                                    slug
                                    brief
                                    publishedAt
                                    coverImage {
                                        url
                                    }
                                }
                            }
                        }
                    }
                }
                `;

                const res = await axios.post(
                    'https://gql.hashnode.com',
                    {
                        query,
                        variables: {
                            _t: new Date().getTime()
                        }
                    },
                    {
                        headers: {
                            'Content-Type': 'application/json',
                            'Cache-Control': 'no-cache'
                        },
                    }
                );

                if (!isMounted) return;

                console.log('Raw API Response:', JSON.stringify(res.data, null, 2));

                if (res.data?.data?.publication?.posts?.edges) {
                    const posts = res.data.data.publication.posts.edges.map(edge => ({
                        title: edge.node.title,
                        slug: edge.node.slug,
                        brief: edge.node.brief,
                        publishedAt: edge.node.publishedAt,
                        coverImage: {
                            url: edge.node.coverImage?.url || ''
                        }
                    }));
                    console.log('Number of posts fetched:', posts.length);
                    console.log('Post titles:', posts.map(p => p.title));
                    console.log('Post dates:', posts.map(p => p.publishedAt));
                    setPosts(posts);
                } else {
                    console.log('Invalid response format:', res.data);
                    throw new Error('Invalid response format');
                }
                setLoading(false);
            } catch (err) {
                if (!isMounted) return;
                console.error('Error fetching blog posts:', err);
                console.error('Error details:', err.response?.data);
                setError('Failed to load blog posts. Please try again later.');
                setLoading(false);
            }
        };

        fetchPosts();

        return () => {
            isMounted = false;
        };
    }, []);


    if (loading) {
        return (
            <div className="blog-loading">
                <div className="loading-spinner"></div>
                <p>Loading blog posts...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="blog-error">
                <h1>Blog</h1>
                <p>{error}</p>
            </div>
        );
    }

    return (
        <div className="blog-container">
            <div className="blog-header">
                <h1>PetWise Blog</h1>
                <p>Stay updated with the latest veterinary insights and PetWise news</p>
            </div>

            <div className="blog-posts">
                {posts.map((post) => (
                    <article key={post.slug} className="blog-post">
                        {post.coverImage?.url ? (
                            <div className="post-image">
                                <img
                                    src={post.coverImage.url}
                                    alt={post.title}
                                    className="cover-image"
                                />
                            </div>
                        ) : (
                            <div className="post-image-placeholder">
                                <div className="placeholder-content">
                                    <h3>PetWise</h3>
                                </div>
                            </div>
                        )}
                        <div className="post-content">
                            <h2 className="post-title">{post.title}</h2>
                            <p className="post-date">
                                {new Date(post.publishedAt).toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                })}
                            </p>
                            <p className="post-brief">{post.brief}</p>
                            <a
                                href={`https://blog.petwise.vet/${post.slug}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="read-more-btn"
                            >
                                Read more →
                            </a>
                        </div>
                    </article>
                ))}
            </div>

            {posts.length === 0 && (
                <div className="no-posts">
                    <p>No blog posts available at the moment. Check back soon!</p>
                </div>
            )}
        </div>
    );
};

export default Blog; 
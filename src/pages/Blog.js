import React, { useEffect, useState } from 'react';
import '../styles/Blog.css';

const CORS_PROXY = 'https://api.allorigins.win/raw?url=';
const RSS_URL = 'https://blog.petwise.vet/rss.xml';

const styles = `
    .refresh-button {
        background: #3cb6fd;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        margin-top: 10px;
        transition: background 0.3s ease;
    }

    .refresh-button:hover {
        background: #2a9ee0;
    }
`;

const styleSheet = document.createElement("style");
styleSheet.innerText = styles;
document.head.appendChild(styleSheet);

const Blog = () => {
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchAllPosts = async () => {
        try {
            let page = 1;
            const allItems = [];
            let hasNextPage = true;

            while (hasNextPage) {
                const url = `${CORS_PROXY}${encodeURIComponent(`https://blog.petwise.vet/rss.xml?page=${page}`)}`;
                const response = await fetch(url);
                const xmlText = await response.text();
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(xmlText, "text/xml");

                const items = xmlDoc.getElementsByTagName("item");
                if (items.length === 0) break;

                const pageItems = Array.from(items).map(item => {
                    const title = item.getElementsByTagName("title")[0]?.textContent?.trim() || '';
                    const link = item.getElementsByTagName("link")[0]?.textContent?.trim() || '';
                    const description = item.getElementsByTagName("description")[0]?.textContent?.trim() || '';
                    const pubDate = item.getElementsByTagName("pubDate")[0]?.textContent?.trim() || '';
                    const hashnodeCoverImage = item.getElementsByTagName("hashnode:coverImage")[0];
                    const imageUrl = hashnodeCoverImage?.textContent?.trim() || '';

                    return {
                        title,
                        slug: link.split('/').pop(),
                        brief: description,
                        publishedAt: pubDate,
                        coverImage: { url: imageUrl }
                    };
                });

                allItems.push(...pageItems);

                const nextLink = xmlDoc.querySelector('link[rel="next"]');
                hasNextPage = !!nextLink || items.length > 0;
                page++;
            }

            setPosts(allItems);
            setLoading(false);
        } catch (err) {
            setError("Failed to load blog posts.");
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAllPosts();
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
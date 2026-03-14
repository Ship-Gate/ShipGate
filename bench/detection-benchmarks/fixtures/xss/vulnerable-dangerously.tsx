import React, { useEffect, useState } from 'react';

interface ArticleProps {
  slug: string;
}

interface Article {
  id: string;
  title: string;
  htmlContent: string;
  author: {
    name: string;
    bio: string;
  };
  publishedAt: string;
  tags: string[];
}

export function ArticlePage({ slug }: ArticleProps) {
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/articles/${slug}`)
      .then((res) => res.json())
      .then((data: Article) => {
        setArticle(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [slug]);

  if (loading) return <div className="spinner">Loading...</div>;
  if (!article) return <div className="error">Article not found</div>;

  return (
    <article className="article-page">
      <header>
        <h1>{article.title}</h1>
        <div className="meta">
          <span className="author">{article.author.name}</span>
          <time dateTime={article.publishedAt}>
            {new Date(article.publishedAt).toLocaleDateString()}
          </time>
        </div>
        <div className="tags">
          {article.tags.map((tag) => (
            <span key={tag} className="tag">{tag}</span>
          ))}
        </div>
      </header>

      <div
        className="article-content"
        dangerouslySetInnerHTML={{ __html: article.htmlContent }}
      />

      <aside className="author-box">
        <h3>About {article.author.name}</h3>
        <div dangerouslySetInnerHTML={{ __html: article.author.bio }} />
      </aside>
    </article>
  );
}

interface UserCommentProps {
  comments: Array<{ id: string; author: string; html: string }>;
}

export function CommentSection({ comments }: UserCommentProps) {
  return (
    <section className="comments">
      <h2>Comments ({comments.length})</h2>
      {comments.map((comment) => (
        <div key={comment.id} className="comment">
          <strong>{comment.author}</strong>
          <div dangerouslySetInnerHTML={{ __html: comment.html }} />
        </div>
      ))}
    </section>
  );
}

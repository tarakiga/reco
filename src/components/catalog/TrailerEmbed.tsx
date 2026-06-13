export function TrailerEmbed({ youtubeKey }: { youtubeKey: string | null }) {
  if (!youtubeKey) return null;
  return (
    <div className="aspect-video w-full overflow-hidden rounded-lg border border-border">
      <iframe
        className="h-full w-full"
        src={`https://www.youtube-nocookie.com/embed/${youtubeKey}`}
        title="Trailer"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        loading="lazy"
      />
    </div>
  );
}

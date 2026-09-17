// Curated for the landing page's hero poster collage — real, currently-valid
// poster_path values pulled from the app's own catalog (not invented/guessed
// TMDB hashes, which would silently 404). A fixed, hand-picked list rather
// than a live API call: this page has no logged-in user and no reason to
// depend on the backend just to look good, and a fixed set keeps the collage
// visually consistent instead of reshuffling on every deploy.
export const HERO_POSTERS = [
  { title: 'Toy Story 5', poster_path: '/sfQtVlIHljToOwYjhe21KPGzZWK.jpg' },
  { title: 'Moana', poster_path: '/2B2XvBZFSOrGt7nptyNoBSFPhfb.jpg' },
  { title: 'Avatar', poster_path: '/gKY6q7SjCkAU6FqvqWybDYgUKIF.jpg' },
  { title: 'Project Hail Mary', poster_path: '/yihdXomYb5kTeSivtFndMy5iDmf.jpg' },
  { title: 'Ted Lasso', poster_path: '/5fhZdwP1DVJ0FyVH6vrFdHwpXIn.jpg' },
  { title: 'The Simpsons', poster_path: '/uWpG7GqfKGQqX4YMAo3nv5OrglV.jpg' },
  { title: 'Home Alone', poster_path: '/1hqGagr94soBq70Lq7tPHvNmmxy.jpg' },
  { title: 'Reacher', poster_path: '/31GlRQMiDunO8cl3NxTz34U64rf.jpg' },
  { title: 'Silo', poster_path: '/c2OijvbFEXBW1onbzuvENr4CGQB.jpg' },
  { title: 'The Odyssey', poster_path: '/5rhTDKUhPYvpdQIijFIs5VoWsON.jpg' },
  { title: 'Masters of the Universe', poster_path: '/oRuyGUHdoaQxWP3SDfafGkStxTC.jpg' },
  { title: 'Mortal Kombat II', poster_path: '/hwRdDFIhaEmpRgoki805YvyyjZf.jpg' },
  { title: 'Spider-Man: Brand New Day', poster_path: '/6Q21yptoOCUq4ErwVncesLPVplb.jpg' },
  { title: 'Colony', poster_path: '/tN799oUR0f1gUKDYdMNrDaY7I51.jpg' },
  { title: 'Descendants: Wicked Wonderland', poster_path: '/xdhLAADGSse8KCrsDLBuM5b68Cg.jpg' },
  { title: 'Mayday', poster_path: '/hVXjX1jLZ1ljFSNGXpjJfbTUOa7.jpg' },
  { title: 'Passenger', poster_path: '/2sOEJzhPzjTkZSlPbGxOJ7xgIyS.jpg' },
  { title: 'Kraken', poster_path: '/xdZ8k5s8DTwWyPBMIcflrYLgcAK.jpg' },
  { title: 'Michael', poster_path: '/zm0KAbOjlt9eR5y7vDiL2dEOwMl.jpg' },
  { title: 'Lioness', poster_path: '/ajaXSmdAlYYhnvx1EIsvpfN949y.jpg' },
  { title: 'Coyote vs. Acme', poster_path: '/vhv7lBWYM0DUuNU2a0V7Rhq21dD.jpg' },
  { title: 'Scary Movie', poster_path: '/znHT8peERZRWG1ME3r0Db0EV8k8.jpg' },
  { title: 'Deep Water', poster_path: '/kjcuS7xaRyqRjVaVcH4t0qHshuX.jpg' },
  { title: 'Above & Below', poster_path: '/7bOuu1SRALGwsG2fLCTvRkCmQBj.jpg' },
];

export const POSTER_BASE = 'https://image.tmdb.org/t/p/w342';

export type EventItem = {
    id: string
    title: string
    organizer: string
    date: string
    location: string
    bannerQuery: string
    color?: string
  }
  
  export const events: EventItem[] = [
    {
      id: "1",
      title: "Sunset Rooftop DJ",
      organizer: "Vibe Collective",
      date: "Fri, Sep 12 • 8:00–11:30 PM",
      location: "Beacon Rooftop, Downtown",
      bannerQuery: "flat illustration rooftop party sunset dj turntable",
      color: "#FFD733",
    },
    {
      id: "2",
      title: "Park Picnic & Games",
      organizer: "Campus Crew",
      date: "Sat, Sep 13 • 2:00–5:00 PM",
      location: "Greenwood Park",
      bannerQuery: "flat illustration park picnic blanket frisbee trees",
      color: "#FFEDD5",
    },
    {
      id: "3",
      title: "Indie Film Night",
      organizer: "Cinema Club",
      date: "Sun, Sep 14 • 7:00–10:00 PM",
      location: "Orpheum Theater",
      bannerQuery: "flat illustration cinema ticket popcorn film reel",
      color: "#EAF3FF",
    },
  ]
  

if (window.quizList == undefined || window.quizList == null) {
    window.quizList = [];
}

window.quizList.push(
    {
        "name": "The Daily Map Quiz",
        "id": "daily",
        "order": "strict",
        "questions": [

        {
            "question": "Which city is known for the iconic clock tower Big Ben?",
            "answer": { "label": "London, England", "lat": 51.5074, "lng": -0.1278 },
            "context": "Big Ben is the nickname for the Great Bell of the clock at the north end of the Palace of Westminster in London, celebrated as a symbol of the United Kingdom."
        },
        {
            "question": "Which city hosts the famous Louvre Museum, home to thousands of works of art including the Mona Lisa?",
            "answer": { "label": "Paris, France", "lat": 48.8566, "lng": 2.3522 },
            "context": "Paris is renowned for its rich history and cultural landmarks, with the Louvre Museum being one of the most visited art museums in the world."
        },
        {
            "question": "Which city is home to the Statue of Liberty, a world-famous symbol of freedom?",
            "answer": { "label": "New York City, USA", "lat": 40.7128, "lng": -74.0060 },
            "context": "New York City is known for many iconic landmarks, with the Statue of Liberty on Liberty Island being a universal symbol of freedom and democracy."
        }
    
        ]
    }
);

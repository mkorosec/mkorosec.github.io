
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
            "question": "Which city is famous for the Golden Gate Bridge, an iconic suspension bridge that opened in 1937?",
            "answer": { "label": "San Francisco, USA", "lat": 37.7749, "lng": -122.4194 },
            "context": "San Francisco is well-known for its stunning Golden Gate Bridge, a remarkable feat of engineering and a popular tourist attraction."
        },
        {
            "question": "Which city is home to the Eiffel Tower, a wrought-iron lattice tower constructed for the 1889 Exposition Universelle?",
            "answer": { "label": "Paris, France", "lat": 48.8566, "lng": 2.3522 },
            "context": "Paris is synonymous with the Eiffel Tower, a landmark that symbolizes the city and attracts millions of visitors each year."
        },
        {
            "question": "In which city would you find the Sydney Opera House, a multi-venue performing arts centre completed in 1973?",
            "answer": { "label": "Sydney, Australia", "lat": -33.8688, "lng": 151.2093 },
            "context": "Sydney Opera House is an architectural icon, recognized globally for its unique sail-like design and cultural significance."
        }
    
        ]
    }
);

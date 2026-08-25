# Adaptive AI Tutor

An intelligent, personalized learning system that evaluates student answers using Natural Language Processing, identifies weak concepts, estimates concept mastery, dynamically adjusts question difficulty, recommends the next question, and tracks learning progress.

## Overview

Traditional quiz systems usually present questions at a fixed difficulty and provide a simple correct/incorrect result.

The **Adaptive AI Tutor** takes a different approach.

It continuously models the student's performance and uses that information to determine:

* Which concepts the student is struggling with
* The estimated mastery level of each concept
* What difficulty level should be presented next
* Which question should be recommended
* How the student's performance changes over time

The project combines **Artificial Intelligence, Natural Language Processing, Recommendation Systems, and Cognitive Modeling** into a single educational application.

## Key Features

### 1. Natural Language Answer Evaluation

The system evaluates free-text student answers rather than relying only on predefined multiple-choice options.

A Sentence Transformer model, `all-MiniLM-L6-v2`, converts the student's answer and the expected answer into semantic embeddings.

Cosine similarity is then used to estimate how closely the student's response matches the expected meaning.

The answer is classified as:

* Correct
* Partially Correct
* Incorrect

### 2. Concept-Level Cognitive Modeling

Instead of maintaining only one overall score, the tutor maintains a separate mastery estimate for every learning concept.

Example:

```text
Overfitting       → 40%
Classification    → 75%
Regression        → 60%
KNN               → 82%
```

This allows the tutor to understand that a student may be strong in one area while struggling with another.

### 3. Weak Concept Detection

The system continuously examines concept mastery and identifies concepts requiring additional practice.

Lower mastery produces a higher recommendation priority.

This allows the tutor to focus learning activity where it is most needed.

### 4. Adaptive Difficulty

Question difficulty is dynamically selected using the estimated mastery of the target concept.

The current adaptive strategy uses:

```text
Mastery < 40%       → Easy
40%–69%             → Medium
70%+                → Hard
```

As the student's mastery changes, the recommended difficulty can change accordingly.

### 5. Intelligent Question Recommendation

The tutor does not select questions completely at random.

It calculates a priority for each concept based on weakness and learning history, then selects an appropriate question from the question bank.

The recommendation pipeline is:

```text
Student Performance
        ↓
Concept Mastery
        ↓
Weakness Detection
        ↓
Concept Priority
        ↓
Difficulty Selection
        ↓
Question Recommendation
```

### 6. Progress Tracking

Every attempt is recorded with information such as:

* Question ID
* Concept
* Difficulty
* Semantic score
* Evaluation
* Concept mastery
* Number of attempts

This allows the learning process to be analyzed after the session.

### 7. Student Dashboard

The project provides visualizations for:

* Concept mastery
* Performance by difficulty
* Mastery progression
* Weak concepts
* Overall performance

### 8. Student Data Persistence

The tutor can save the student's cognitive profile and learning history as a JSON file.

Progress can also be exported into CSV files for further analysis.

## System Architecture

```text
                    ADAPTIVE AI TUTOR
                           |
                           v
                    Question Bank
                           |
                           v
                 Adaptive Selection
                           |
                           v
                    Student Answer
                           |
                           v
                Sentence Transformer
                           |
                           v
                 Semantic Similarity
                           |
                           v
                  Answer Evaluation
                           |
                           v
                  Cognitive Model
                           |
              +------------+------------+
              |                         |
              v                         v
        Concept Mastery          Weak Concepts
              |                         |
              +------------+------------+
                           |
                           v
                 Recommendation Engine
                           |
                           v
                  Difficulty Selection
                           |
                           v
                    Next Question
                           |
                           v
                  Progress Tracking
                           |
                           v
                     Dashboard
```

## Technologies Used

| Technology            | Purpose                     |
| --------------------- | --------------------------- |
| Python                | Core implementation         |
| Google Colab          | Development environment     |
| Pandas                | Data management             |
| NumPy                 | Numerical operations        |
| Scikit-learn          | Similarity calculation      |
| Sentence Transformers | Semantic NLP evaluation     |
| Matplotlib            | Visualization               |
| Seaborn               | Data visualization          |
| JSON                  | Student profile persistence |
| CSV                   | Progress export             |

## NLP Method

The tutor uses the Sentence Transformer model:

```text
all-MiniLM-L6-v2
```

The process is:

```text
Expected Answer
       |
       v
Sentence Embedding
       |
       |
       +------------------+
                          |
Student Answer            |
       |                  |
       v                  |
Sentence Embedding        |
       |                  |
       +--------+---------+
                |
                v
       Cosine Similarity
                |
                v
       Semantic Score
                |
                v
       Answer Evaluation
```

This allows semantically similar answers to receive credit even when their wording is different.

## Cognitive Modeling

The tutor maintains a student profile for each concept.

Each concept contains:

```python
{
    "mastery": 50.0,
    "attempts": 0,
    "correct": 0,
    "incorrect": 0,
    "partial": 0
}
```

The mastery estimate is updated after each answer.

The current baseline update strategy is:

```text
Correct Answer          → +10 mastery
Partially Correct       → +3 mastery
Incorrect Answer        → -10 mastery
```

Mastery is constrained between 0 and 100.

This creates a dynamic representation of the student's estimated knowledge state.

## Recommendation Strategy

The tutor calculates a concept priority using:

```text
Weakness Score = 100 - Mastery

Exploration Bonus = additional priority
                    for concepts not yet attempted
```

The concept with the highest priority becomes the target learning concept.

The tutor then chooses an appropriate difficulty based on the concept's mastery.

## Question Bank

The current demonstration question bank contains concepts from Machine Learning, including:

* Overfitting
* Underfitting
* Classification
* Regression
* Cross Validation
* KNN

Each concept contains:

* Easy question
* Medium question
* Hard question

This structure makes it possible to demonstrate adaptive learning behavior.

## Example Adaptive Behavior

Suppose the student begins with:

```text
Overfitting = 50%
```

After an incorrect response:

```text
Overfitting = 40%
```

The system recognizes the concept as requiring attention.

After additional incorrect responses:

```text
Overfitting = 30%
```

The recommendation engine prioritizes Overfitting and selects an easier question.

If the student subsequently answers correctly:

```text
30% → 40% → 50% → 60% → 70%
```

the tutor can gradually increase the difficulty:

```text
Easy → Medium → Hard
```

Therefore, the learning path is personalized according to performance.

## Project Workflow

```text
1. Student receives a question
2. Student submits a free-text answer
3. NLP model calculates semantic similarity
4. Answer is classified
5. Concept mastery is updated
6. Weak concepts are identified
7. Recommendation priority is calculated
8. Next difficulty is selected
9. Next question is recommended
10. Progress is recorded
11. Dashboard is updated
```

## Running the Project

### Option 1 — Google Colab

Open the notebook in Google Colab and execute the cells sequentially.

The first cell installs the required libraries.

The Sentence Transformer model is downloaded when it is first loaded.

After initialization, start a tutoring session using:

```python
start_tutoring_session()
```

### Option 2 — Local Python Environment

Install the dependencies:

```bash
pip install sentence-transformers pandas numpy scikit-learn matplotlib seaborn
```

Then execute the notebook or convert the notebook code into Python modules.

## Project Outputs

The project can generate:

```text
student_profile.json
adaptive_tutor_progress.csv
concept_mastery.csv
```

These files contain student learning information and can be used for further analysis.

## Limitations

This project is a prototype educational AI system and has several limitations.

### 1. Small Question Bank

The current demonstration uses a relatively small manually created question bank.

A production system would require a much larger and curriculum-specific question database.

### 2. Baseline Mastery Model

The mastery update mechanism is intentionally simple.

It does not yet represent a complete psychological or educational knowledge-tracing model.

### 3. Semantic Similarity Is Not Full Understanding

Sentence Transformers provide semantic similarity rather than complete human-level evaluation.

A response can be semantically similar while still containing a factual error.

### 4. Difficulty Is Predefined

Questions are currently labeled as Easy, Medium, or Hard manually.

A future version could estimate question difficulty automatically using historical student performance.

## Future Enhancements

Potential future improvements include:

* LLM-based answer evaluation
* Personalized explanations
* Automatic hint generation
* Automatic question generation
* More advanced knowledge tracing
* Bayesian Knowledge Tracing
* Deep Knowledge Tracing
* Automatic question difficulty estimation
* Student-specific learning curves
* Response-time analysis
* Forgetting-curve modeling
* Voice-based interaction
* Multilingual tutoring
* Web-based interface
* Student authentication
* Database-backed profiles
* Teacher analytics dashboard

## Learning and AI Concepts Demonstrated

This project demonstrates practical applications of:

* Natural Language Processing
* Sentence Embeddings
* Semantic Similarity
* Machine Learning
* Recommendation Systems
* Adaptive Learning
* Cognitive Modeling
* Knowledge Representation
* Data Analysis
* Data Visualization
* Personalization

## Why This Project Is Different

A conventional quiz system follows:

```text
Question
   ↓
Answer
   ↓
Correct / Incorrect
```

This project follows:

```text
Question
   ↓
Student Answer
   ↓
Semantic Evaluation
   ↓
Concept Identification
   ↓
Mastery Estimation
   ↓
Weakness Detection
   ↓
Difficulty Adaptation
   ↓
Question Recommendation
   ↓
Progress Tracking
```

The system therefore demonstrates an **adaptive learning loop** rather than simply functioning as a question-answering chatbot.

## Project Type

**Artificial Intelligence + Natural Language Processing + Recommendation System + Cognitive Modeling**

## Development Environment

**Google Colab + Python**

## Author

**Kunal Datta**

---

### Conclusion

The Adaptive AI Tutor demonstrates how AI techniques can be combined to create a personalized educational system. Instead of treating every student identically, the tutor maintains a concept-level representation of the student's estimated knowledge and uses it to adapt subsequent questions.

The project provides a foundation for more advanced intelligent tutoring systems using knowledge tracing, large language models, automatic question generation, and personalized learning strategies.

import httpx
import time

def test_generation():
    client = httpx.Client(base_url="http://localhost:8000")
    
    response = client.post("/v1/generations/modules", headers={
        "X-Lumen-User-Id": "test-user-123"
    }, json={
        "prompt": "Create a module about Artificial Intelligence for beginners. Include real world applications.",
        "output_language": "English",
        "depth": 5,
        "use_web_search": True,
        "reference_file_ids": [],
        "use_reference_visuals": True
    })
    
    if response.status_code != 202:
        print(f"Error starting generation: {response.status_code} {response.text}")
        return
        
    job = response.json()
    job_id = job["id"]
    print(f"Started job {job_id}")
    
    while True:
        res = client.get(f"/v1/generations/{job_id}", headers={
            "X-Lumen-User-Id": "test-user-123"
        })
        if res.status_code != 200:
            print(f"Error polling: {res.status_code} {res.text}")
            break
            
        status = res.json()
        print(f"Status: {status['status']}, Stage: {status.get('stage')}, Progress: {status.get('progress_percent')}%")
        
        if status["status"] in ["completed", "failed"]:
            print(f"Finished: {status}")
            break
            
        time.sleep(2)

if __name__ == "__main__":
    test_generation()

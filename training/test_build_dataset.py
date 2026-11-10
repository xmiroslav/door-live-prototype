import unittest
from build_dataset import build
def item(name,group,verified):
    return {"file":name,"group":group,"keypoints_xy":[[1,1],[10,1],[10,20],[1,20]],
            "annotation_plane":"outer_existing_frame_and_trim","verified":verified}
class DatasetTests(unittest.TestCase):
    def test_unverified_blocked(self):
        m=build({"images":[item("a","one",False),item("b","two",False)]})
        self.assertFalse(m["ready_for_training"]);self.assertEqual(len(m["images"]),0)
    def test_group_isolation(self):
        m=build({"images":[item("a","one",True),item("b","one",True),item("c","two",True)]})
        self.assertTrue(m["ready_for_training"])
        self.assertEqual(m["images"][0]["split"],m["images"][1]["split"])
        self.assertNotEqual(m["images"][0]["split"],m["images"][2]["split"])
    def test_experimental_does_not_become_verified(self):
        m=build({"images":[item("a","one",False),item("b","two",False)]},True)
        self.assertEqual(m["status"],"experimental")
        self.assertFalse(any(x["verified"] for x in m["images"]))
if __name__=="__main__":unittest.main()

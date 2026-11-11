import unittest
import numpy as np
from group_cross_validation import group_folds, select_penalty

class GroupCrossValidationTests(unittest.TestCase):
    def test_augmented_views_of_one_door_are_never_split(self):
        groups = ['a', 'a', 'b', 'b', 'c', 'c']
        for train, held in group_folds(groups):
            self.assertFalse(set(np.array(groups)[train]) & set(np.array(groups)[held]))
            self.assertEqual(len(held), 2)

    def test_selection_is_deterministic_and_uses_only_supplied_data(self):
        x = np.array([[0.,0.],[.1,0.],[1.,0.],[1.1,0.],[0.,1.],[0.,1.1]])
        y = np.column_stack([x[:,0], x[:,1]]*4)
        groups = ['a','a','b','b','c','c']
        a = select_penalty(x, y, groups, [0.01, 10.0])
        b = select_penalty(x, y, groups, [0.01, 10.0])
        self.assertEqual(a, b)
        self.assertEqual(a['selected_penalty'], 0.01)

if __name__ == '__main__': unittest.main()
